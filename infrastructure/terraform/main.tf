# Main Terraform configuration for Startup Metrics Benchmarking Platform
# Provider version: hashicorp/aws ~> 4.0
# Provider version: hashicorp/kubernetes ~> 2.0

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "startup-metrics-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    replica_regions = ["us-west-2"]
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Local variables
locals {
  environment = terraform.workspace
  common_tags = {
    Environment   = local.environment
    Project      = "Startup Metrics Platform"
    ManagedBy    = "Terraform"
    BackupEnabled = "true"
    DR           = "enabled"
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# KMS keys for encryption
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                   = local.common_tags
}

resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                   = local.common_tags
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  cidr_block           = var.vpc_cidr
  azs                  = data.aws_availability_zones.available.names
  private_subnets      = var.private_subnet_cidrs
  public_subnets       = var.public_subnet_cidrs
  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_vpn_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = local.common_tags
}

# EKS Module
module "eks" {
  source = "./modules/eks"

  cluster_name    = "${local.environment}-metrics-platform"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  cluster_version = var.eks_version

  node_instance_types = var.eks_node_instance_types
  desired_capacity   = var.eks_desired_capacity
  max_capacity      = var.eks_max_capacity
  min_capacity      = var.eks_min_capacity

  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }

  enable_irsa = true
  tags        = local.common_tags
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  identifier = "${local.environment}-metrics-db"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  engine               = "postgres"
  engine_version      = "14"
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
  storage_encrypted   = true
  kms_key_id         = aws_kms_key.rds.arn

  multi_az               = true
  backup_retention_period = var.db_backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  deletion_protection         = true
  performance_insights_enabled = true
  monitoring_interval         = 60

  tags = local.common_tags
}

# ElastiCache Redis Module
module "redis" {
  source = "./modules/elasticache"

  cluster_id           = "${local.environment}-metrics-cache"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnets
  node_type           = var.redis_node_type
  num_cache_clusters  = 2
  engine_version      = "6.x"
  port                = 6379
  
  multi_az_enabled     = true
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = local.common_tags
}

# S3 Bucket for reports and exports
resource "aws_s3_bucket" "reports" {
  bucket = "${local.environment}-metrics-reports"
  
  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "aws:kms"
        kms_master_key_id = aws_kms_key.s3.arn
      }
    }
  }

  lifecycle_rule {
    enabled = true
    
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 365
    }
  }

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.redis.endpoint
}