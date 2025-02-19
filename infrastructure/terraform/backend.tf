# Provider version constraint
# hashicorp/aws ~> 4.0

# Backend configuration for Terraform state management
# Implements high-availability state storage with disaster recovery capabilities
# Supports multi-environment deployments through workspace prefixing
terraform {
  backend "s3" {
    # Primary state storage configuration
    bucket         = "startup-metrics-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    
    # Security configuration
    encrypt        = true
    acl            = "private"
    kms_key_id     = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID"
    
    # State file encryption
    server_side_encryption = "AES256"
    
    # State locking configuration using DynamoDB
    dynamodb_table = "terraform-state-lock"
    
    # Multi-environment support through workspaces
    workspace_key_prefix = "env"
    
    # Enable versioning for state history and recovery
    versioning = true
    
    # Additional backend settings
    force_path_style = false
    
    # Access logging configuration
    access_log {
      target_bucket = "startup-metrics-terraform-logs"
      target_prefix = "tf-state-access-logs/"
    }
  }
}

# Backend configuration validation
terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}