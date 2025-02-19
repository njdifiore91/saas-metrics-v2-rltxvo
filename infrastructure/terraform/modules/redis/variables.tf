# Environment name for resource naming and tagging
variable "environment" {
  type        = string
  description = "Environment name (e.g., production, staging, development)"
  validation {
    condition     = can(regex("^(production|staging|development)$", var.environment))
    error_message = "Environment must be one of: production, staging, development."
  }
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where Redis cluster will be deployed"
  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier."
  }
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for Redis cluster deployment"
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets are required for high availability."
  }
}

# Redis cluster configuration
variable "redis_node_type" {
  type        = string
  description = "Instance type for Redis nodes"
  default     = "cache.r5.large"
  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.redis_node_type))
    error_message = "Redis node type must be a valid AWS ElastiCache instance type."
  }
}

variable "redis_num_nodes" {
  type        = number
  description = "Number of nodes in Redis cluster"
  default     = 2
  validation {
    condition     = var.redis_num_nodes >= 2
    error_message = "Minimum of 2 nodes required for high availability."
  }
}

variable "redis_port" {
  type        = number
  description = "Port number for Redis connections"
  default     = 6379
  validation {
    condition     = var.redis_port > 0 && var.redis_port < 65536
    error_message = "Port number must be between 1 and 65535."
  }
}

variable "redis_engine_version" {
  type        = string
  description = "Redis engine version"
  default     = "6.2"
  validation {
    condition     = can(regex("^6\\.[2-9]", var.redis_engine_version))
    error_message = "Redis version must be 6.2 or higher."
  }
}

variable "parameter_group_family" {
  type        = string
  description = "Redis parameter group family"
  default     = "redis6.x"
}

# High availability configuration
variable "automatic_failover_enabled" {
  type        = bool
  description = "Enable automatic failover for high availability"
  default     = true
}

variable "multi_az_enabled" {
  type        = bool
  description = "Enable Multi-AZ deployment for disaster recovery"
  default     = true
}

# Backup configuration
variable "snapshot_retention_limit" {
  type        = number
  description = "Number of days to retain automatic Redis backups"
  default     = 7
  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  type        = string
  description = "Daily time range for automated Redis snapshot creation"
  default     = "03:00-04:00"
  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.snapshot_window))
    error_message = "Snapshot window must be in format HH:MM-HH:MM."
  }
}

variable "maintenance_window" {
  type        = string
  description = "Weekly time range for system maintenance tasks"
  default     = "sun:05:00-sun:06:00"
  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-5][0-9]:[0-5][0-9]-(mon|tue|wed|thu|fri|sat|sun):[0-5][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in format ddd:HH:MM-ddd:HH:MM."
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for cost allocation and management"
  default     = {}
}