# Terraform configuration for Startup Metrics Platform staging environment
# Provider version: hashicorp/aws ~> 4.0

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # Terraform state backend configuration
  backend "s3" {
    bucket         = "startup-metrics-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    kms_key_id     = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/terraform-state-key"
  }
}

# Provider configuration for staging environment
provider "aws" {
  region  = "us-east-1"
  profile = "staging"

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "Startup Metrics Platform"
      ManagedBy   = "Terraform"
      CostCenter  = "Engineering-Staging"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformStagingRole"
  }
}

# Local variables for staging environment
locals {
  environment = "staging"
  common_tags = {
    Environment  = local.environment
    Project      = "Startup Metrics Platform"
    ManagedBy    = "Terraform"
    CostCenter   = "Engineering-Staging"
  }
}

# Root infrastructure module for staging environment
module "root_config" {
  source = "../../"

  # Project configuration
  project_name = "startup-metrics"
  aws_region   = "us-east-1"
  environment  = local.environment
  tags         = local.common_tags

  # VPC configuration
  vpc_cidr = "10.1.0.0/16"

  # EKS configuration
  eks_node_instance_types = ["t3.large"]
  eks_desired_capacity    = 2
  eks_max_capacity       = 4
  eks_min_capacity       = 2

  # Database configuration
  db_instance_class        = "db.t3.large"
  db_backup_retention_days = 7
  db_multi_az             = true
  monitoring_interval     = 60
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  deletion_protection     = true
  auto_minor_version_upgrade = true

  # Redis configuration
  cache_node_type         = "cache.t3.medium"
  redis_num_cache_nodes   = 2
  redis_automatic_failover = true

  # Storage configuration
  storage_bucket_prefix   = "startup-metrics-staging"
}

# Outputs
output "vpc_id" {
  description = "VPC ID for the staging environment"
  value       = module.root_config.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for the staging environment"
  value       = module.root_config.eks_cluster_endpoint
}

output "db_endpoint" {
  description = "Database endpoint for the staging environment"
  value       = module.root_config.rds_endpoint
}