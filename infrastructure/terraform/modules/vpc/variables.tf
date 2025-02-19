variable "environment" {
  type        = string
  description = "The deployment environment (e.g., production, staging, development)"
  
  validation {
    condition     = can(regex("^(production|staging|development)$", var.environment))
    error_message = "Environment must be one of: production, staging, development"
  }
}

variable "region" {
  type        = string
  description = "AWS region where the VPC will be created"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.region))
    error_message = "Region must be a valid AWS region format (e.g., us-west-2)"
  }
}

variable "cidr_block" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "CIDR block must be in valid format"
  }
}

variable "availability_zones" {
  type        = number
  description = "Number of availability zones to use for the VPC"
  default     = 3
  
  validation {
    condition     = var.availability_zones > 1 && var.availability_zones <= 3
    error_message = "Number of availability zones must be between 2 and 3"
  }
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Whether to create NAT Gateways for private subnets"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all resources created by this module"
  default     = {}
}