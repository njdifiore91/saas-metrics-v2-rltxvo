# Provider configuration with AWS provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for consistent tagging
locals {
  default_tags = {
    Environment = var.environment
    Terraform   = "true"
    Service     = "redis-cache"
    Component   = "elasticache"
    ManagedBy   = "terraform"
  }
}

# Subnet group for Redis cluster deployment
resource "aws_elasticache_subnet_group" "redis" {
  name        = format("%s-redis-subnet-group", var.environment)
  subnet_ids  = var.private_subnet_ids
  description = "Private subnet group for Redis cluster in ${var.environment} environment"
  tags        = merge(var.tags, local.default_tags)
}

# Parameter group for Redis 6.2+ with optimized settings
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis6.x"
  name        = format("%s-redis-params", var.environment)
  description = "Custom parameters for Redis cluster in ${var.environment}"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "client-output-buffer-limit-normal-hard-limit"
    value = "0"
  }

  parameter {
    name  = "client-output-buffer-limit-normal-soft-limit"
    value = "0"
  }

  parameter {
    name  = "client-output-buffer-limit-normal-soft-seconds"
    value = "0"
  }

  tags = merge(var.tags, local.default_tags)
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = format("%s-redis-sg", var.environment)
  description = "Security group for Redis cluster in ${var.environment}"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis access from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, local.default_tags)
}

# Redis replication group with multi-AZ support
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = format("%s-redis-cluster", var.environment)
  description                   = "Redis cluster for Startup Metrics Platform - ${var.environment}"
  node_type                     = "cache.r5.large"
  num_cache_clusters           = var.redis_num_nodes
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  engine                      = "redis"
  engine_version              = "6.2"
  snapshot_retention_limit    = 7
  snapshot_window             = "00:00-01:00"
  maintenance_window          = "sun:01:00-sun:02:00"
  security_group_ids          = [aws_security_group.redis.id]
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auto_minor_version_upgrade = true
  apply_immediately          = true
  tags                       = merge(var.tags, local.default_tags)
}

# Output the Redis cluster identifier
output "redis_cluster_id" {
  description = "The ID of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.id
}

# Output the Redis endpoint
output "redis_endpoint" {
  description = "The endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# Output the Redis security group ID
output "redis_security_group_id" {
  description = "The ID of the Redis security group"
  value       = aws_security_group.redis.id
}