#!/usr/bin/env bash

# restore.sh - PostgreSQL Database Restore Script
# Version: 1.0.0
# Required packages:
# - postgresql-client v14
# - openssl v1.1.1
# - gzip v1.10

set -euo pipefail

# Script directory and global constants
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
DEFAULT_BACKUP_BASE_DIR="/backup/postgresql"
DEFAULT_ENCRYPTION_KEY_PATH="/etc/backup/keys/backup.key"
DEFAULT_LOG_DIR="/var/log/backup"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEFAULT_DB_HOST="localhost"
DEFAULT_DB_PORT="5432"
DEFAULT_DB_NAME="startup_metrics"
DEFAULT_MAX_PARALLEL_JOBS="4"
DEFAULT_BUFFER_SIZE="8MB"
DEFAULT_NETWORK_TIMEOUT="3600"
DEFAULT_RETRY_ATTEMPTS="3"
NOTIFICATION_ENDPOINT="http://monitoring.internal/notify"
LOG_FORMAT="[%s] [%s] %s"

# Function: Enhanced logging with structured format
log_message() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S.%3N')"
    local log_entry
    printf -v log_entry "$LOG_FORMAT" "$timestamp" "$level" "$message"
    
    # Ensure log directory exists
    mkdir -p "$DEFAULT_LOG_DIR"
    
    # Write to log file
    echo "$log_entry" >> "${DEFAULT_LOG_DIR}/restore_${TIMESTAMP}.log"
    
    # Send critical logs to monitoring
    if [[ "$level" == "ERROR" || "$level" == "CRITICAL" ]]; then
        curl -s -X POST "$NOTIFICATION_ENDPOINT" \
             -H "Content-Type: application/json" \
             -d "{\"level\":\"$level\",\"message\":\"$message\"}" || true
    fi
}

# Function: Parse and validate command line arguments
parse_command_line_args() {
    local args=("$@")
    
    # Default values
    BACKUP_FILE=""
    DB_HOST="$DEFAULT_DB_HOST"
    DB_PORT="$DEFAULT_DB_PORT"
    DB_NAME="$DEFAULT_DB_NAME"
    ENCRYPTION_KEY_PATH="$DEFAULT_ENCRYPTION_KEY_PATH"
    MAX_PARALLEL_JOBS="$DEFAULT_MAX_PARALLEL_JOBS"
    
    # Parse command line arguments
    while getopts ":f:h:p:d:k:j:" opt; do
        case $opt in
            f) BACKUP_FILE="$OPTARG" ;;
            h) DB_HOST="$OPTARG" ;;
            p) DB_PORT="$OPTARG" ;;
            d) DB_NAME="$OPTARG" ;;
            k) ENCRYPTION_KEY_PATH="$OPTARG" ;;
            j) MAX_PARALLEL_JOBS="$OPTARG" ;;
            \?)
                log_message "ERROR" "Invalid option: -$OPTARG"
                return 1
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$BACKUP_FILE" ]]; then
        log_message "ERROR" "Backup file (-f) is required"
        return 1
    fi
    
    # Export settings as environment variables
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGDATABASE="$DB_NAME"
    
    return 0
}

# Function: Verify system prerequisites
check_prerequisites() {
    local required_commands=("pg_restore" "openssl" "gzip" "curl")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            log_message "ERROR" "Required command not found: $cmd"
            return 1
        fi
    done
    
    # Verify PostgreSQL connection
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -t 30; then
        log_message "ERROR" "Cannot connect to PostgreSQL server"
        return 1
    fi
    
    # Check encryption key
    if [[ ! -r "$ENCRYPTION_KEY_PATH" ]]; then
        log_message "ERROR" "Cannot read encryption key: $ENCRYPTION_KEY_PATH"
        return 1
    fi
    
    # Check available disk space
    local required_space=$((20*1024*1024)) # 20GB minimum
    local available_space
    available_space=$(df -k . | awk 'NR==2 {print $4}')
    
    if (( available_space < required_space )); then
        log_message "ERROR" "Insufficient disk space"
        return 1
    fi
    
    return 0
}

# Function: Verify backup file integrity
verify_backup_file() {
    local backup_file="$1"
    
    # Check file existence and readability
    if [[ ! -r "$backup_file" ]]; then
        log_message "ERROR" "Cannot read backup file: $backup_file"
        return 1
    fi
    
    # Verify file checksum if available
    if [[ -f "${backup_file}.sha256" ]]; then
        if ! sha256sum -c "${backup_file}.sha256"; then
            log_message "ERROR" "Backup file checksum verification failed"
            return 1
        fi
    fi
    
    # Verify encryption signature
    if ! openssl dgst -sha256 -verify "${ENCRYPTION_KEY_PATH}.pub" \
         -signature "${backup_file}.sig" "$backup_file" >/dev/null 2>&1; then
        log_message "ERROR" "Backup file signature verification failed"
        return 1
    fi
    
    return 0
}

# Function: Perform database restore
perform_restore() {
    local backup_file="$1"
    local target_database="$2"
    local temp_dir
    temp_dir=$(mktemp -d)
    local return_code=0
    
    log_message "INFO" "Starting restore of $target_database from $backup_file"
    
    # Create temporary working directory
    trap 'rm -rf "$temp_dir"' EXIT
    
    # Decrypt and decompress backup
    if ! openssl enc -d -aes-256-cbc -in "$backup_file" \
         -out "$temp_dir/backup.gz" -pass file:"$ENCRYPTION_KEY_PATH"; then
        log_message "ERROR" "Failed to decrypt backup file"
        return 1
    fi
    
    if ! gzip -d "$temp_dir/backup.gz"; then
        log_message "ERROR" "Failed to decompress backup file"
        return 1
    fi
    
    # Perform restore with retry logic
    local attempt=1
    while (( attempt <= DEFAULT_RETRY_ATTEMPTS )); do
        log_message "INFO" "Restore attempt $attempt of $DEFAULT_RETRY_ATTEMPTS"
        
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -d "$target_database" \
           -j "$MAX_PARALLEL_JOBS" --clean --if-exists \
           -v "$temp_dir/backup" > "$temp_dir/restore.log" 2>&1; then
            log_message "INFO" "Restore completed successfully"
            return_code=0
            break
        else
            log_message "WARNING" "Restore attempt $attempt failed"
            if (( attempt == DEFAULT_RETRY_ATTEMPTS )); then
                log_message "ERROR" "All restore attempts failed"
                return_code=1
                break
            fi
            sleep $((attempt * 5))
            ((attempt++))
        fi
    done
    
    # Clean up temporary files securely
    find "$temp_dir" -type f -exec shred -u {} \;
    
    return "$return_code"
}

# Function: Verify restored database
verify_restore() {
    local target_database="$1"
    
    log_message "INFO" "Verifying restore of $target_database"
    
    # Check database connectivity
    if ! psql -d "$target_database" -c "SELECT 1" >/dev/null 2>&1; then
        log_message "ERROR" "Cannot connect to restored database"
        return 1
    fi
    
    # Verify database integrity
    if ! psql -d "$target_database" -c "VACUUM ANALYZE" >/dev/null 2>&1; then
        log_message "ERROR" "Database integrity check failed"
        return 1
    }
    
    # Check for invalid indexes
    if psql -d "$target_database" -t -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE indexdef IS NULL" | grep .; then
        log_message "ERROR" "Invalid indexes found in restored database"
        return 1
    fi
    
    # Verify row counts match backup metadata if available
    if [[ -f "${BACKUP_FILE}.meta" ]]; then
        while IFS=, read -r table expected_count; do
            local actual_count
            actual_count=$(psql -d "$target_database" -t -c "SELECT COUNT(*) FROM $table" | tr -d '[:space:]')
            if [[ "$actual_count" != "$expected_count" ]]; then
                log_message "ERROR" "Row count mismatch in table $table"
                return 1
            fi
        done < "${BACKUP_FILE}.meta"
    fi
    
    log_message "INFO" "Database verification completed successfully"
    return 0
}

# Main execution
main() {
    log_message "INFO" "Starting database restore process"
    
    if ! parse_command_line_args "$@"; then
        log_message "ERROR" "Failed to parse command line arguments"
        exit 1
    fi
    
    if ! check_prerequisites; then
        log_message "ERROR" "System prerequisites check failed"
        exit 1
    fi
    
    if ! verify_backup_file "$BACKUP_FILE"; then
        log_message "ERROR" "Backup file verification failed"
        exit 1
    fi
    
    if ! perform_restore "$BACKUP_FILE" "$DB_NAME"; then
        log_message "ERROR" "Database restore failed"
        exit 1
    fi
    
    if ! verify_restore "$DB_NAME"; then
        log_message "ERROR" "Restore verification failed"
        exit 1
    fi
    
    log_message "INFO" "Database restore completed successfully"
    exit 0
}

# Execute main function with all arguments
main "$@"