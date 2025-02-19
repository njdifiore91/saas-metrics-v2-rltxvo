#!/bin/bash

# Database Backup Script for Startup Metrics Platform
# Version: 1.0.0
# Dependencies:
# - postgresql-client v14
# - openssl v1.1.1
# - gzip v1.10

set -euo pipefail

# Global variables
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
BACKUP_BASE_DIR="/backup/postgresql"
ENCRYPTION_KEY_PATH="/etc/backup/keys/backup.key"
LOG_DIR="/var/log/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION_LEVEL=9
FULL_BACKUP_DAY=7
MIN_REQUIRED_SPACE_GB=50
DB_HOST="localhost"
DB_PORT=5432
DB_NAME="startup_metrics"

# Initialize backup settings with environment variable overrides
initialize_backup_settings() {
    # Override defaults with environment variables if present
    BACKUP_BASE_DIR=${BACKUP_BASE_DIR:-"/backup/postgresql"}
    ENCRYPTION_KEY_PATH=${ENCRYPTION_KEY_PATH:-"/etc/backup/keys/backup.key"}
    LOG_DIR=${LOG_DIR:-"/var/log/backup"}
    BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
    DB_HOST=${DB_HOST:-"localhost"}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-"startup_metrics"}

    # Create required directories
    mkdir -p "${BACKUP_BASE_DIR}" "${LOG_DIR}"
    
    # Verify encryption key exists and has correct permissions
    if [[ ! -f "${ENCRYPTION_KEY_PATH}" ]]; then
        log_message "ERROR" "Encryption key not found at ${ENCRYPTION_KEY_PATH}"
        return 1
    fi
    
    chmod 600 "${ENCRYPTION_KEY_PATH}"
    return 0
}

# Check all prerequisites before backup
check_prerequisites() {
    local required_space_bytes=$((MIN_REQUIRED_SPACE_GB * 1024 * 1024 * 1024))
    local available_space
    
    # Check required tools
    command -v pg_dump >/dev/null 2>&1 || { log_message "ERROR" "pg_dump not found"; return 1; }
    command -v openssl >/dev/null 2>&1 || { log_message "ERROR" "openssl not found"; return 1; }
    command -v gzip >/dev/null 2>&1 || { log_message "ERROR" "gzip not found"; return 1; }
    
    # Check available disk space
    available_space=$(df -B1 "${BACKUP_BASE_DIR}" | awk 'NR==2 {print $4}')
    if [[ ${available_space} -lt ${required_space_bytes} ]]; then
        log_message "ERROR" "Insufficient disk space. Required: ${MIN_REQUIRED_SPACE_GB}GB, Available: $((available_space/1024/1024/1024))GB"
        return 1
    }
    
    # Test database connection
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" >/dev/null 2>&1 || {
        log_message "ERROR" "Database connection failed"
        return 1
    }
    
    return 0
}

# Perform the backup operation
perform_backup() {
    local backup_type=$1
    local backup_file="${BACKUP_BASE_DIR}/${TIMESTAMP}_${backup_type}_${DB_NAME}.sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.enc"
    local iv_file="${encrypted_file}.iv"
    local checksum_file="${encrypted_file}.sha256"
    
    log_message "INFO" "Starting ${backup_type} backup of ${DB_NAME}"
    
    # Perform database dump
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -F p \
        -v \
        > "${backup_file}" || {
        log_message "ERROR" "Database dump failed"
        return 1
    }
    
    # Compress backup
    gzip -"${BACKUP_COMPRESSION_LEVEL}" "${backup_file}" || {
        log_message "ERROR" "Backup compression failed"
        return 1
    }
    
    # Generate random IV for encryption
    openssl rand 16 > "${iv_file}"
    
    # Encrypt backup
    openssl enc -aes-256-cbc \
        -in "${compressed_file}" \
        -out "${encrypted_file}" \
        -pass file:"${ENCRYPTION_KEY_PATH}" \
        -iv "$(cat "${iv_file}")" || {
        log_message "ERROR" "Backup encryption failed"
        return 1
    }
    
    # Generate checksum
    sha256sum "${encrypted_file}" > "${checksum_file}"
    
    # Cleanup intermediate files
    rm -f "${backup_file}" "${compressed_file}"
    
    log_message "INFO" "Backup completed successfully: ${encrypted_file}"
    return 0
}

# Clean up old backups
cleanup_old_backups() {
    local retention_date
    retention_date=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y%m%d)
    
    log_message "INFO" "Cleaning up backups older than ${retention_date}"
    
    find "${BACKUP_BASE_DIR}" -type f -name "*.enc" -mtime +"${BACKUP_RETENTION_DAYS}" | while read -r backup_file; do
        # Remove backup and associated files
        rm -f "${backup_file}" "${backup_file}.iv" "${backup_file}.sha256"
        log_message "INFO" "Removed old backup: ${backup_file}"
    done
    
    return 0
}

# Log message with timestamp and severity
log_message() {
    local level=$1
    local message=$2
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S.%3N')
    
    echo "[${timestamp}] [${level}] ${message}" >> "${LOG_DIR}/backup.log"
    
    # Also output to console if not running in cron
    if [[ -t 1 ]]; then
        echo "[${timestamp}] [${level}] ${message}"
    fi
}

# Main execution
main() {
    local backup_type
    
    # Initialize settings
    initialize_backup_settings || exit 1
    
    # Check prerequisites
    check_prerequisites || exit 1
    
    # Determine backup type based on day of week
    if [[ $(date +%u) -eq ${FULL_BACKUP_DAY} ]]; then
        backup_type="full"
    else
        backup_type="incremental"
    fi
    
    # Perform backup
    perform_backup "${backup_type}" || exit 1
    
    # Cleanup old backups
    cleanup_old_backups || exit 1
    
    log_message "INFO" "Backup process completed successfully"
    return 0
}

# Execute main function
main "$@"