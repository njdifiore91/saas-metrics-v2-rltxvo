#!/bin/bash

# Setup Logging Infrastructure Script
# Version: 1.0.0
# Description: Automates the setup and configuration of ELK stack with Fluentd
# Required versions:
# - elasticsearch: 7.17.0
# - kibana: 7.17.0
# - fluentd: 1.15.0

set -euo pipefail

# Global variables
ES_CLUSTER_NAME=${ES_CLUSTER_NAME:-"startup-metrics-es-cluster"}
ES_NODE_COUNT=${ES_NODE_COUNT:-3}
KIBANA_PORT=${KIBANA_PORT:-5601}
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-7}
SECURITY_CERT_PATH=${SECURITY_CERT_PATH:-"/etc/elk/certs"}
BACKUP_PATH=${BACKUP_PATH:-"/var/backup/elk"}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-300}
MAX_RETRIES=${MAX_RETRIES:-3}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local message=$@
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
}

# Error handling function
handle_error() {
    local exit_code=$?
    log "ERROR" "An error occurred on line $1"
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

setup_elasticsearch() {
    local cluster_name=$1
    local node_count=$2
    local cert_path=$3
    local backup_path=$4

    log "INFO" "Setting up Elasticsearch cluster: ${cluster_name}"

    # Create necessary directories
    mkdir -p "${cert_path}" "${backup_path}"
    
    # Generate certificates
    log "INFO" "Generating SSL certificates"
    /usr/share/elasticsearch/bin/elasticsearch-certutil cert \
        --out "${cert_path}/elastic-certificates.p12" \
        --pass "" \
        --silent

    # Configure system limits
    cat > /etc/security/limits.d/elasticsearch.conf << EOF
elasticsearch soft nofile 65535
elasticsearch hard nofile 65535
elasticsearch soft memlock unlimited
elasticsearch hard memlock unlimited
EOF

    # Deploy Elasticsearch configuration
    for i in $(seq 1 $node_count); do
        local node_name="es-node-${i}"
        local node_path="/etc/elasticsearch/${node_name}"
        
        mkdir -p "${node_path}"
        cp infrastructure/logging/elasticsearch/elasticsearch.yml "${node_path}/"
        
        # Set node-specific configurations
        sed -i "s/\${NODE_NAME}/${node_name}/" "${node_path}/elasticsearch.yml"
        sed -i "s/\${NODE_ZONE}/zone-${i}/" "${node_path}/elasticsearch.yml"
    done

    # Start Elasticsearch service
    systemctl enable elasticsearch
    systemctl start elasticsearch

    # Wait for cluster to be ready
    local retries=0
    while [[ $retries -lt $MAX_RETRIES ]]; do
        if curl -s "localhost:9200/_cluster/health" | grep -q '"status":"green"'; then
            log "INFO" "Elasticsearch cluster is healthy"
            return 0
        fi
        ((retries++))
        sleep 10
    done

    log "ERROR" "Failed to start Elasticsearch cluster"
    return 1
}

setup_kibana() {
    local elasticsearch_hosts=$1
    local port=$2
    local cert_path=$3
    local security_config=$4

    log "INFO" "Setting up Kibana"

    # Create Kibana directories
    mkdir -p /etc/kibana/certs /var/log/kibana

    # Copy certificates
    cp "${cert_path}/elastic-certificates.p12" /etc/kibana/certs/
    
    # Deploy Kibana configuration
    cp infrastructure/logging/kibana/kibana.yml /etc/kibana/

    # Configure security settings
    local encryption_key=$(openssl rand -base64 32)
    sed -i "s/\${SECURITY_ENCRYPTION_KEY}/${encryption_key}/" /etc/kibana/kibana.yml
    
    # Start Kibana service
    systemctl enable kibana
    systemctl start kibana

    # Verify Kibana is running
    local retries=0
    while [[ $retries -lt $MAX_RETRIES ]]; do
        if curl -s "localhost:${port}/api/status" | grep -q '"status":{"overall":{"level":"available"'; then
            log "INFO" "Kibana is running"
            return 0
        fi
        ((retries++))
        sleep 10
    done

    log "ERROR" "Failed to start Kibana"
    return 1
}

setup_fluentd() {
    local elasticsearch_host=$1
    local log_patterns_path=$2
    local cert_path=$3
    local security_config=$4

    log "INFO" "Setting up Fluentd"

    # Install Fluentd plugins
    gem install fluent-plugin-elasticsearch:5.2.4 \
                fluent-plugin-grok-parser:2.6.2 \
                fluent-plugin-kubernetes_metadata_filter:2.13.0

    # Create Fluentd directories
    mkdir -p /etc/fluent/patterns.d /var/log/fluentd/buffer

    # Deploy Fluentd configuration
    cp infrastructure/logging/fluentd/fluent.conf /etc/fluent/
    cp infrastructure/logging/fluentd/patterns.d/* /etc/fluent/patterns.d/

    # Configure security settings
    chown -R fluentd:fluentd /var/log/fluentd
    chmod 700 /var/log/fluentd

    # Start Fluentd service
    systemctl enable td-agent
    systemctl start td-agent

    # Verify Fluentd is running
    local retries=0
    while [[ $retries -lt $MAX_RETRIES ]]; do
        if systemctl is-active td-agent >/dev/null 2>&1; then
            log "INFO" "Fluentd is running"
            return 0
        fi
        ((retries++))
        sleep 10
    done

    log "ERROR" "Failed to start Fluentd"
    return 1
}

verify_logging_stack() {
    local health_check_interval=$1
    local max_retries=$2

    log "INFO" "Verifying logging stack"

    # Check Elasticsearch cluster health
    if ! curl -s "localhost:9200/_cluster/health" | grep -q '"status":"green"'; then
        log "ERROR" "Elasticsearch cluster is not healthy"
        return 1
    fi

    # Check Kibana status
    if ! curl -s "localhost:${KIBANA_PORT}/api/status" | grep -q '"status":{"overall":{"level":"available"'; then
        log "ERROR" "Kibana is not available"
        return 1
    fi

    # Check Fluentd status
    if ! systemctl is-active td-agent >/dev/null 2>&1; then
        log "ERROR" "Fluentd is not running"
        return 1
    }

    # Verify end-to-end log flow
    local test_log="Test log message $(date '+%s')"
    logger "${test_log}"
    
    sleep 5
    
    if ! curl -s "localhost:9200/_search?q=${test_log}" | grep -q "${test_log}"; then
        log "ERROR" "End-to-end log flow verification failed"
        return 1
    fi

    log "INFO" "Logging stack verification completed successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting logging infrastructure setup"

    # Setup Elasticsearch
    setup_elasticsearch "${ES_CLUSTER_NAME}" "${ES_NODE_COUNT}" "${SECURITY_CERT_PATH}" "${BACKUP_PATH}" || exit 1

    # Setup Kibana
    setup_kibana "http://localhost:9200" "${KIBANA_PORT}" "${SECURITY_CERT_PATH}" "" || exit 1

    # Setup Fluentd
    setup_fluentd "localhost" "/etc/fluent/patterns.d" "${SECURITY_CERT_PATH}" "" || exit 1

    # Verify entire stack
    verify_logging_stack "${HEALTH_CHECK_INTERVAL}" "${MAX_RETRIES}" || exit 1

    log "INFO" "Logging infrastructure setup completed successfully"
}

# Execute main function
main "$@"