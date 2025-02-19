# Project and environment configuration
project_name = "startup-metrics-dev"
aws_region   = "us-west-2"
vpc_cidr     = "10.0.0.0/16"

# EKS cluster configuration - development optimized
eks_node_instance_types = ["t3.medium"]
eks_desired_capacity    = 2
eks_max_capacity       = 4
eks_min_capacity       = 1

# RDS configuration - development tier
db_instance_class        = "db.t3.medium"
db_backup_retention_days = 7

# ElastiCache configuration - development tier
cache_node_type       = "cache.t3.medium"
redis_num_cache_nodes = 2

# Storage configuration
storage_bucket_prefix = "startup-metrics-dev"

# Additional development environment tags
tags = {
  Environment     = "development"
  ManagedBy      = "terraform"
  CostCenter     = "development"
  DataClass      = "non-production"
  BackupSchedule = "weekly"
}