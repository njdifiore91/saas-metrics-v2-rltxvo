# Terraform ~> 1.0

variable "environment" {
  type        = string
  description = "Environment name (e.g., development, staging, production)"
  
  validation {
    condition     = can(regex("^(development|staging|production)$", var.environment))
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "bucket_prefix" {
  type        = string
  description = "Prefix for the S3 bucket name"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.bucket_prefix))
    error_message = "Bucket prefix must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "versioning_enabled" {
  type        = bool
  description = "Whether to enable versioning on the S3 bucket"
  default     = true
}

variable "lifecycle_rules_enabled" {
  type        = bool
  description = "Whether to enable lifecycle rules for the S3 bucket"
  default     = true
}

variable "transition_days" {
  type        = number
  description = "Number of days before transitioning objects to STANDARD_IA storage class"
  default     = 90
  
  validation {
    condition     = var.transition_days >= 30
    error_message = "Transition days must be at least 30 days"
  }
}

variable "expiration_days" {
  type        = number
  description = "Number of days before objects expire and are deleted"
  default     = 365
  
  validation {
    condition     = var.expiration_days >= 90
    error_message = "Expiration days must be at least 90 days"
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all resources created by this module"
  default     = {}
}