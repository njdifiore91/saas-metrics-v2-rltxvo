# Project name variable for consistent resource naming
variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming and tagging"
  default     = "startup-metrics"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.project_name))
    error_message = "Project name must start with a letter and only contain lowercase letters, numbers, and hyphens"
  }
}

# Primary AWS region for resource deployment
variable "aws_region" {
  type        = string
  description = "Primary AWS region for resource deployment"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be in valid format (e.g., us-west-2)"
  }
}

# VPC CIDR block for network segmentation
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC network segmentation"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be in valid format"
  }
}

# EKS node instance types for web and application tiers
variable "eks_node_instance_types" {
  type        = list(string)
  description = "Instance types for EKS node groups (web tier: t3.medium, app tier: t3.large)"
  default     = ["t3.medium", "t3.large"]

  validation {
    condition     = length(var.eks_node_instance_types) == 2
    error_message = "Must specify exactly two instance types (web tier and app tier)"
  }
}

# EKS cluster capacity settings for auto-scaling
variable "eks_desired_capacity" {
  type        = number
  description = "Desired number of nodes in EKS cluster for baseline workload"

  validation {
    condition     = var.eks_desired_capacity >= 2
    error_message = "Desired capacity must be at least 2 for high availability"
  }
}

variable "eks_max_capacity" {
  type        = number
  description = "Maximum number of nodes in EKS cluster for peak loads"

  validation {
    condition     = var.eks_max_capacity >= 4
    error_message = "Maximum capacity must be at least 4 to handle peak loads"
  }
}

variable "eks_min_capacity" {
  type        = number
  description = "Minimum number of nodes in EKS cluster for high availability"

  validation {
    condition     = var.eks_min_capacity >= 2
    error_message = "Minimum capacity must be at least 2 for high availability"
  }
}

# RDS instance configuration for production database
variable "db_instance_class" {
  type        = string
  description = "RDS instance type for production database workload"
  default     = "db.r5.xlarge"

  validation {
    condition     = can(regex("^db\\.r5\\.", var.db_instance_class))
    error_message = "Database instance class must be from r5 family for production workloads"
  }
}

# RDS backup retention for disaster recovery
variable "db_backup_retention_days" {
  type        = number
  description = "Number of days to retain RDS automated backups"
  default     = 7

  validation {
    condition     = var.db_backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days for production workloads"
  }
}

# ElastiCache configuration for Redis cluster
variable "cache_node_type" {
  type        = string
  description = "ElastiCache Redis node type for production caching"
  default     = "cache.r5.large"

  validation {
    condition     = can(regex("^cache\\.r5\\.", var.cache_node_type))
    error_message = "Cache node type must be from r5 family for production workloads"
  }
}

# Redis cluster size for high availability
variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of nodes in Redis cluster for high availability"
  default     = 2

  validation {
    condition     = var.redis_num_cache_nodes >= 2
    error_message = "Redis cluster must have at least 2 nodes for high availability"
  }
}

# S3 bucket naming prefix for storage
variable "storage_bucket_prefix" {
  type        = string
  description = "Prefix for S3 bucket names with versioning and replication"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.storage_bucket_prefix))
    error_message = "Storage bucket prefix must contain only lowercase letters, numbers, and hyphens"
  }
}