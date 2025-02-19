# Terraform S3 Module Configuration
# AWS Provider Version: ~> 4.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Primary S3 bucket for report storage with environment-specific naming
resource "aws_s3_bucket" "reports_storage" {
  bucket        = "${var.bucket_prefix}-${var.environment}-reports"
  force_destroy = false

  tags = merge(var.tags, {
    Environment = var.environment
    Service     = "reports-storage"
    ManagedBy   = "terraform"
  })
}

# Enable versioning for data protection and recovery
resource "aws_s3_bucket_versioning" "reports_storage_versioning" {
  bucket = aws_s3_bucket.reports_storage.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

# Configure mandatory server-side encryption with AES-256
resource "aws_s3_bucket_server_side_encryption_configuration" "reports_storage_encryption" {
  bucket = aws_s3_bucket.reports_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Implement intelligent lifecycle management for cost optimization
resource "aws_s3_bucket_lifecycle_rule" "reports_storage_lifecycle" {
  bucket = aws_s3_bucket.reports_storage.id
  enabled = var.lifecycle_rules_enabled
  id      = "reports-lifecycle-rule"

  transition {
    days          = var.transition_days
    storage_class = "STANDARD_IA"
  }

  expiration {
    days = var.expiration_days
  }

  noncurrent_version_expiration {
    days = 90
  }
}

# Block all public access for enhanced security
resource "aws_s3_bucket_public_access_block" "reports_storage_public_access" {
  bucket = aws_s3_bucket.reports_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configure CORS for web application access
resource "aws_s3_bucket_cors_configuration" "reports_storage_cors" {
  bucket = aws_s3_bucket.reports_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Enable bucket logging for audit and compliance
resource "aws_s3_bucket_logging" "reports_storage_logging" {
  bucket = aws_s3_bucket.reports_storage.id

  target_bucket = aws_s3_bucket.reports_storage.id
  target_prefix = "access-logs/"
}

# Output important bucket attributes for other modules
output "bucket_id" {
  description = "The ID of the S3 bucket"
  value       = aws_s3_bucket.reports_storage.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.reports_storage.arn
}

output "bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.reports_storage.bucket
}