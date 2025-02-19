# Production environment Terraform configuration for Startup Metrics Benchmarking Platform
# Provider version: hashicorp/aws ~> 4.0

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "startup-metrics-terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-prod"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment     = "production"
      Project        = "Startup Metrics Platform"
      ManagedBy      = "Terraform"
      Compliance     = "SOC2"
      BackupRetention = "30days"
    }
  }
}

# Root module instantiation with production-grade configurations
module "root" {
  source = "../.."

  aws_region = var.aws_region
  vpc_cidr   = "10.0.0.0/16"

  # Production-grade database configuration
  db_instance_class        = "db.r5.xlarge"
  db_backup_retention_days = 30

  # Production-grade cache configuration
  cache_node_type       = "cache.r5.large"
  redis_num_cache_nodes = 3

  # Production-grade EKS configuration
  eks_node_instance_types = ["t3.large"]
  eks_desired_capacity    = 3
  eks_max_capacity       = 10
  eks_min_capacity       = 2

  # High-availability and disaster recovery settings
  multi_az_enabled                = true
  enable_cross_region_replication = true
  enable_vpc_flow_logs           = true
  
  # Security configurations
  enable_guard_duty   = true
  enable_security_hub = true

  # Storage configuration
  storage_bucket_prefix = "startup-metrics-prod"

  environment = "production"
  
  tags = {
    Environment      = "production"
    Project         = "Startup Metrics Platform"
    ManagedBy       = "Terraform"
    Compliance      = "SOC2"
    BackupRetention = "30days"
    DR             = "Enabled"
    SecurityLevel   = "High"
  }
}

# Production environment outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = module.root.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Production EKS cluster endpoint"
  value       = module.root.eks_cluster_endpoint
}

output "rds_endpoint" {
  description = "Production RDS endpoint"
  value       = module.root.rds_endpoint
}