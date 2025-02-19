# HashiCorp Vault Server Configuration
# Version: 1.13.0

# Cluster settings
cluster_name = "startup-metrics-vault"
api_addr = "https://vault.startup-metrics.internal:8200"
cluster_addr = "https://vault.startup-metrics.internal:8201"

# Disable memory locking - should be false in production for security
disable_mlock = false

# Disable UI access for security
ui = false

# Storage configuration using Raft for high availability
storage "raft" {
  path = "/vault/data"
  node_id = "vault-server-1"
  
  retry_join {
    leader_api_addr = "https://vault-2.startup-metrics.internal:8200"
    leader_ca_cert_file = "/vault/tls/ca.crt"
  }
  
  retry_join {
    leader_api_addr = "https://vault-3.startup-metrics.internal:8200"
    leader_ca_cert_file = "/vault/tls/ca.crt"
  }
}

# Listener configuration with mutual TLS
listener "tcp" {
  address = "0.0.0.0:8200"
  
  # TLS configuration
  tls_cert_file = "/vault/tls/tls.crt"
  tls_key_file = "/vault/tls/tls.key"
  tls_client_ca_file = "/vault/tls/ca.crt"
  tls_require_and_verify_client_cert = true
  
  # TLS security parameters
  tls_min_version = "tls12"
  tls_prefer_server_cipher_suites = true
  tls_cipher_suites = [
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
  ]
}

# AWS KMS seal configuration for auto-unseal
seal "awskms" {
  region = "us-east-1"
  kms_key_id = "alias/vault-unseal-key"
}

# Telemetry configuration
telemetry {
  statsite_address = "statsite.startup-metrics.internal:8125"
  disable_hostname = true
}

# Audit logging configuration
audit_device "file" {
  path = "/vault/logs/audit.log"
  log_raw = false
}