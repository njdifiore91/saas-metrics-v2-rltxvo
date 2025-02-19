# Startup Metrics Benchmarking Platform - Vault Access Policy
# Version: 1.13.0

# Global path restrictions
path "secret/startup-metrics/*" {
  capabilities = ["deny"]
}

# Database credentials access
path "secret/startup-metrics/database/*" {
  capabilities = ["read"]
  allowed_parameters = {
    "environment" = ["production", "staging"]
  }
  denied_parameters = {
    "*" = []
  }
}

# API credentials access
path "secret/startup-metrics/api/*" {
  capabilities = ["read"]
  allowed_parameters = {
    "service" = ["google-oauth", "sendgrid", "aws"]
  }
  min_wrapping_ttl = "1h"
  max_wrapping_ttl = "24h"
}

# Encryption key access
path "secret/startup-metrics/encryption/*" {
  capabilities = ["read"]
  allowed_parameters = {
    "key_type" = ["aes256-gcm96"]
  }
  min_wrapping_ttl = "1h"
  max_wrapping_ttl = "24h"
}

# Transit encryption operations
path "transit/startup-metrics/encrypt/*" {
  capabilities = ["create", "update"]
  allowed_parameters = {
    "type" = ["aes256-gcm96"]
    "plaintext" = []
  }
  required_parameters = ["plaintext"]
}

# Transit decryption operations
path "transit/startup-metrics/decrypt/*" {
  capabilities = ["create", "update"]
  allowed_parameters = {
    "ciphertext" = []
  }
  required_parameters = ["ciphertext"]
}

# Token creation and management
path "auth/token/create" {
  capabilities = ["create", "update"]
  allowed_parameters = {
    "policies" = ["startup-metrics-app"]
    "ttl" = ["1h", "12h", "24h"]
    "display_name" = []
  }
  denied_parameters = {
    "period" = []
    "explicit_max_ttl" = []
  }
}

# Token renewal
path "auth/token/renew" {
  capabilities = ["update"]
  allowed_parameters = {
    "increment" = ["1h", "12h"]
  }
}

# Token lookup for audit
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Audit logging configuration
path "sys/audit" {
  capabilities = ["read"]
}

# Compliance-related metadata
path "sys/internal/counters/tokens" {
  capabilities = ["read"]
}

# Health check access
path "sys/health" {
  capabilities = ["read"]
}

# Seal status check
path "sys/seal-status" {
  capabilities = ["read"]
}

# Policy metadata
policy_metadata = {
  "version" = "1.0"
  "compliance_standards" = ["GDPR", "CCPA", "SOC2"]
  "owner" = "security-team"
  "review_period" = "90d"
}

# Rate limiting configuration
rate_limit_quota "token_creation" {
  path = "auth/token/create"
  interval = "1m"
  max_requests = 10
}

# Audit logging requirements
audit_non_hmac_request_keys = [
  "plaintext",
  "ciphertext"
]

audit_non_hmac_response_keys = [
  "plaintext",
  "ciphertext"
]