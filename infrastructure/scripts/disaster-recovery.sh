#!/usr/bin/env bash

# Disaster Recovery Script for Startup Metrics Platform
# Version: 1.0.0
# Dependencies:
# - kubernetes-cli v1.24+
# - awscli v2.0+
# - postgresql-client v14+
# - openssl v1.1.1+

set -euo pipefail

# Global variables
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
LOG_DIR="/var/log/disaster-recovery"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RECOVERY_WORKSPACE="/tmp/disaster-recovery"
MAX_RETRY_ATTEMPTS=3
HEALTH_CHECK_INTERVAL=30
RECOVERY_TIMEOUT=14400  # 4 hours (RTO requirement)

# Source required functions from backup scripts
source "${SCRIPT_DIR}/../backup/scripts/database-backup.sh"
source "${SCRIPT_DIR}/../backup/scripts/restore.sh"

# Initialize recovery environment and validate prerequisites
initialize_recovery() {
    log_message "INFO" "Initializing disaster recovery environment"
    
    # Create recovery workspace
    mkdir -p "${RECOVERY_WORKSPACE}"
    mkdir -p "${LOG_DIR}"
    
    # Validate AWS credentials and configuration
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_message "ERROR" "Invalid AWS credentials or configuration"
        return 1
    }
    
    # Verify Kubernetes cluster access
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_message "ERROR" "Cannot access Kubernetes cluster"
        return 1
    }
    
    # Check required tools
    local required_tools=("kubectl" "aws" "psql" "openssl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_message "ERROR" "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Validate encryption keys
    if [[ ! -f "/etc/backup/keys/recovery.key" ]]; then
        log_message "ERROR" "Recovery encryption key not found"
        return 1
    fi
    
    log_message "INFO" "Recovery environment initialized successfully"
    return 0
}

# Assess current system state and identify recovery needs
assess_system_state() {
    local assessment_result
    assessment_result="${RECOVERY_WORKSPACE}/assessment_${TIMESTAMP}.json"
    
    log_message "INFO" "Starting system state assessment"
    
    # Check database health
    local db_status
    if ! db_status=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" 2>/dev/null); then
        echo '{"database": "failed", "replication": "unknown"}' > "${assessment_result}"
    else
        echo '{"database": "healthy", "replication": "active"}' > "${assessment_result}"
    fi
    
    # Check Kubernetes services
    local k8s_status
    k8s_status=$(kubectl get pods -A -o json | jq -r '.items[].status.phase' | sort | uniq -c | jq -R -s -c 'split("\n")[:-1]')
    jq --arg k8s "$k8s_status" '. + {"kubernetes": $k8s}' "${assessment_result}" > "${assessment_result}.tmp"
    mv "${assessment_result}.tmp" "${assessment_result}"
    
    # Check SSL certificates
    local cert_status
    cert_status=$(openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" 2>/dev/null | openssl x509 -noout -dates)
    jq --arg cert "$cert_status" '. + {"ssl": $cert}' "${assessment_result}" > "${assessment_result}.tmp"
    mv "${assessment_result}.tmp" "${assessment_result}"
    
    log_message "INFO" "System state assessment completed"
    echo "${assessment_result}"
}

# Execute recovery plan with automated rollback capability
execute_recovery_plan() {
    local assessment_file="$1"
    local start_time
    start_time=$(date +%s)
    
    log_message "INFO" "Starting recovery execution"
    
    # Create recovery point
    if ! perform_backup "pre_recovery"; then
        log_message "ERROR" "Failed to create recovery point"
        return 1
    fi
    
    # Stop affected services
    log_message "INFO" "Stopping affected services"
    kubectl scale deployment --all --replicas=0 -n production
    
    # Execute database restore if needed
    if [[ $(jq -r '.database' "${assessment_file}") == "failed" ]]; then
        log_message "INFO" "Initiating database restore"
        if ! perform_restore "${LATEST_BACKUP}" "${DB_NAME}"; then
            log_message "ERROR" "Database restore failed"
            rollback_recovery
            return 1
        fi
    fi
    
    # Rebuild infrastructure components
    log_message "INFO" "Rebuilding infrastructure components"
    kubectl apply -f "${SCRIPT_DIR}/../k8s/production/"
    
    # Wait for services to be ready
    local timeout=300
    if ! kubectl wait --for=condition=ready pod --all -n production --timeout="${timeout}s"; then
        log_message "ERROR" "Services failed to start within timeout"
        rollback_recovery
        return 1
    fi
    
    # Check recovery time against RTO
    local current_time
    current_time=$(date +%s)
    local elapsed_time=$((current_time - start_time))
    
    if [[ ${elapsed_time} -gt ${RECOVERY_TIMEOUT} ]]; then
        log_message "ERROR" "Recovery exceeded RTO limit of 4 hours"
        return 1
    fi
    
    log_message "INFO" "Recovery plan executed successfully"
    return 0
}

# Verify recovery success
verify_recovery() {
    log_message "INFO" "Starting recovery verification"
    
    # Verify database consistency
    if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT COUNT(*) FROM metrics" >/dev/null 2>&1; then
        log_message "ERROR" "Database verification failed"
        return 1
    fi
    
    # Verify API endpoints
    local endpoints=("metrics" "benchmarks" "companies")
    for endpoint in "${endpoints[@]}"; do
        if ! curl -sf "https://${DOMAIN}/api/v1/${endpoint}" >/dev/null 2>&1; then
            log_message "ERROR" "API endpoint verification failed: ${endpoint}"
            return 1
        fi
    done
    
    # Verify service health
    if ! kubectl get pods -n production | grep -q "Running"; then
        log_message "ERROR" "Service health verification failed"
        return 1
    fi
    
    # Verify data integrity
    if ! verify_data_integrity; then
        log_message "ERROR" "Data integrity verification failed"
        return 1
    fi
    
    log_message "INFO" "Recovery verification completed successfully"
    return 0
}

# Execute recovery rollback if needed
rollback_recovery() {
    log_message "WARNING" "Initiating recovery rollback"
    
    # Stop all services
    kubectl scale deployment --all --replicas=0 -n production
    
    # Restore from pre-recovery backup
    if ! perform_restore "${RECOVERY_WORKSPACE}/pre_recovery_${TIMESTAMP}.sql.gz" "${DB_NAME}"; then
        log_message "CRITICAL" "Rollback failed - manual intervention required"
        return 1
    fi
    
    # Restore original infrastructure state
    kubectl apply -f "${SCRIPT_DIR}/../k8s/production/original-state/"
    
    log_message "INFO" "Recovery rollback completed"
    return 0
}

# Log recovery status with detailed information
log_recovery_status() {
    local stage="$1"
    local status="$2"
    local message="$3"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S.%3N')
    
    # Format log entry
    printf "[%s] [%s] [%s] %s\n" "${timestamp}" "${stage}" "${status}" "${message}" >> "${LOG_DIR}/recovery_${TIMESTAMP}.log"
    
    # Update status dashboard
    if [[ -n "${DASHBOARD_ENDPOINT:-}" ]]; then
        curl -X POST "${DASHBOARD_ENDPOINT}" \
             -H "Content-Type: application/json" \
             -d "{\"timestamp\":\"${timestamp}\",\"stage\":\"${stage}\",\"status\":\"${status}\",\"message\":\"${message}\"}" || true
    fi
    
    # Send critical notifications
    if [[ "${status}" == "ERROR" || "${status}" == "CRITICAL" ]]; then
        notify_stakeholders "${stage}" "${status}" "${message}"
    fi
}

# Main execution
main() {
    log_recovery_status "START" "INFO" "Initiating disaster recovery process"
    
    if ! initialize_recovery; then
        log_recovery_status "INIT" "ERROR" "Recovery initialization failed"
        exit 1
    fi
    
    local assessment_results
    assessment_results=$(assess_system_state)
    
    if ! execute_recovery_plan "${assessment_results}"; then
        log_recovery_status "EXECUTE" "ERROR" "Recovery execution failed"
        exit 1
    fi
    
    if ! verify_recovery; then
        log_recovery_status "VERIFY" "ERROR" "Recovery verification failed"
        rollback_recovery
        exit 1
    fi
    
    log_recovery_status "COMPLETE" "INFO" "Disaster recovery completed successfully"
    exit 0
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi