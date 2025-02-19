# Development environment Terraform configuration for Startup Metrics Platform
# Provider version: hashicorp/aws ~> 4.0

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# AWS Provider configuration for development environment
provider "aws" {
  region  = var.aws_region
  profile = "development"
  
  default_tags {
    tags = {
      Environment = "development"
      Project     = "Startup Metrics Platform"
      ManagedBy   = "Terraform"
      CostCenter  = "Development"
    }
  }
}

# Root module configuration for development environment
module "root_module" {
  source = "../../"

  # VPC Configuration
  aws_region           = "us-west-2"
  environment          = "development"
  vpc_cidr            = "10.0.0.0/16"
  vpc_private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  vpc_public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  # EKS Configuration
  eks_node_instance_types = ["t3.medium"]
  eks_desired_capacity    = 2
  eks_max_capacity       = 4
  eks_min_capacity       = 1
  eks_cluster_version    = "1.24"

  # RDS Configuration
  db_instance_class         = "db.t3.medium"
  db_allocated_storage      = 20
  db_max_allocated_storage  = 50
  db_backup_retention_days  = 7
  db_multi_az              = false

  # Redis Configuration
  cache_node_type         = "cache.t3.medium"
  redis_num_cache_nodes   = 2
  redis_automatic_failover = false

  # Storage Configuration
  storage_bucket_prefix     = "startup-metrics-dev"
  storage_versioning_enabled = true
  storage_lifecycle_rules = {
    transition_glacier_days = 90
    expiration_days        = 365
  }

  # Monitoring Configuration
  monitoring_enabled     = true
  alarm_cpu_threshold    = 80
  alarm_memory_threshold = 80
  backup_enabled        = true
  log_retention_days    = 30
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.root_module.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.root_module.eks_cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.root_module.rds_endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.root_module.redis_endpoint
}