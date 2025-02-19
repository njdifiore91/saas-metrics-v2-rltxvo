#!/usr/bin/env bash

# Startup Metrics Benchmarking Platform - Vault Initialization Script
# Version: 1.13.0
# Dependencies:
# - vault: 1.13.0
# - jq: 1.6
# - aws-cli: 2.0

set -euo pipefail

# Global variables
export VAULT_ADDR="https://127.0.0.1:8200"
export VAULT_CONFIG_PATH="/vault/config/config.hcl"
export VAULT_POLICY_PATH="/vault/policies/app-policy.hcl"
export VAULT_TOKEN_FILE="/vault/data/.root-token"
export VAULT_KEYS_FILE="/vault/data/.unseal-keys"

# Logging configuration
readonly LOG_FILE="/vault/logs/init.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

log() {
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] $1"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    for cmd in vault jq aws; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            log "ERROR: Required command not found: $cmd"
            return 1
        fi
    done
    
    # Verify configuration files
    if [[ ! -f "$VAULT_CONFIG_PATH" ]]; then
        log "ERROR: Vault configuration file not found at $VAULT_CONFIG_PATH"
        return 1
    fi
    
    if [[ ! -f "$VAULT_POLICY_PATH" ]]; then
        log "ERROR: Policy file not found at $VAULT_POLICY_PATH"
        return 1
    }
    
    return 0
}

check_vault_status() {
    log "Checking Vault status..."
    local timeout=60
    local start_time
    start_time=$(date +%s)
    
    while true; do
        if [[ $(($(date +%s) - start_time)) -gt $timeout ]]; then
            log "ERROR: Vault status check timed out after ${timeout}s"
            return 2
        fi
        
        if vault status >/dev/null 2>&1; then
            local initialized
            initialized=$(vault status -format=json | jq -r .initialized)
            
            if [[ "$initialized" == "true" ]]; then
                log "Vault is already initialized"
                return 0
            else
                log "Vault is not initialized"
                return 1
            fi
        fi
        
        sleep 5
    done
}

initialize_vault() {
    log "Initializing Vault..."
    
    # Initialize with 5 key shares and 3 key threshold
    local init_response
    init_response=$(vault operator init \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json)
    
    # Securely store initialization response
    echo "$init_response" | jq -r .root_token > "$VAULT_TOKEN_FILE"
    echo "$init_response" | jq -r .unseal_keys_b64 > "$VAULT_KEYS_FILE"
    
    # Set secure permissions
    chmod 600 "$VAULT_TOKEN_FILE" "$VAULT_KEYS_FILE"
    
    # Backup keys to AWS KMS
    if [[ -n "$init_response" ]]; then
        log "Backing up initialization keys to AWS KMS..."
        aws kms encrypt \
            --key-id alias/vault-backup-key \
            --plaintext "$(echo "$init_response" | base64)" \
            --output text \
            --query CiphertextBlob > "/vault/data/.init-backup.enc"
    fi
    
    return 0
}

configure_auth() {
    local root_token="$1"
    log "Configuring authentication..."
    
    export VAULT_TOKEN="$root_token"
    
    # Enable audit logging
    vault audit enable file file_path=/vault/logs/audit.log
    
    # Enable AppRole authentication
    vault auth enable approle
    
    # Configure token settings
    vault write sys/auth/token/tune \
        default_lease_ttl=1h \
        max_lease_ttl=24h \
        token_type=default-service
    
    # Load application policy
    vault policy write startup-metrics-app "$VAULT_POLICY_PATH"
    
    # Create AppRole with strict settings
    vault write auth/approle/role/startup-metrics \
        token_ttl=1h \
        token_max_ttl=24h \
        token_policies=startup-metrics-app \
        bind_secret_id=true \
        secret_id_bound_cidrs=10.0.0.0/8 \
        token_bound_cidrs=10.0.0.0/8
}

setup_encryption() {
    local root_token="$1"
    log "Configuring encryption..."
    
    export VAULT_TOKEN="$root_token"
    
    # Enable transit secrets engine
    vault secrets enable transit
    
    # Create encryption keys with rotation
    vault write -f transit/keys/startup-metrics-key \
        type=aes256-gcm96 \
        exportable=false \
        allow_plaintext_backup=false
    
    # Configure key rotation
    vault write transit/keys/startup-metrics-key/config \
        min_decryption_version=1 \
        deletion_allowed=false \
        auto_rotate_period=30d
    
    # Enable convergent encryption for specific data
    vault write -f transit/keys/startup-metrics-convergent-key \
        type=aes256-gcm96 \
        convergent_encryption=true \
        derived=true
}

cleanup() {
    log "Performing secure cleanup..."
    
    # Securely clear sensitive variables
    unset VAULT_TOKEN
    
    # Remove temporary files
    find /tmp -type f -name "vault-*" -exec shred -u {} \;
}

main() {
    local exit_code=0
    
    trap cleanup EXIT
    
    log "Starting Vault initialization process..."
    
    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR: Prerequisites check failed"
        return 1
    fi
    
    # Check Vault status
    local status_check
    status_check=$(check_vault_status)
    case $status_check in
        0)  log "Vault is already initialized"
            return 0
            ;;
        2)  log "ERROR: Vault status check timed out"
            return 1
            ;;
    esac
    
    # Initialize Vault
    if ! initialize_vault; then
        log "ERROR: Vault initialization failed"
        return 1
    fi
    
    # Read root token
    local root_token
    root_token=$(cat "$VAULT_TOKEN_FILE")
    
    # Configure authentication
    if ! configure_auth "$root_token"; then
        log "ERROR: Authentication configuration failed"
        exit_code=1
    fi
    
    # Setup encryption
    if ! setup_encryption "$root_token"; then
        log "ERROR: Encryption setup failed"
        exit_code=1
    fi
    
    if [[ $exit_code -eq 0 ]]; then
        log "Vault initialization completed successfully"
    else
        log "Vault initialization completed with errors"
    fi
    
    return $exit_code
}

# Execute main function
main "$@"