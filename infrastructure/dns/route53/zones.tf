# Configure AWS Route53 hosted zones for the Startup Metrics Benchmarking Platform
# Provider: hashicorp/aws ~> 4.0

# Local variables for consistent naming and tagging
locals {
  domain_name = "${var.project_name}.com"
  api_domain  = "api.${local.domain_name}"
  zone_tags = {
    Environment = terraform.workspace
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "DNS Management"
  }
}

# Primary hosted zone for the main domain
resource "aws_route53_zone" "primary_zone" {
  name = local.domain_name
  
  vpc {
    vpc_id = data.aws_vpc.main.id
  }

  tags = local.zone_tags

  lifecycle {
    prevent_destroy = true
  }
}

# API subdomain hosted zone
resource "aws_route53_zone" "api_zone" {
  name = local.api_domain

  vpc {
    vpc_id = data.aws_vpc.main.id
  }

  tags = merge(local.zone_tags, {
    Type = "API"
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Health check for primary endpoint
resource "aws_route53_health_check" "primary" {
  fqdn              = local.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(local.zone_tags, {
    Name = "Primary-Health-Check"
  })
}

# Health check for API endpoint
resource "aws_route53_health_check" "api" {
  fqdn              = local.api_domain
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(local.zone_tags, {
    Name = "API-Health-Check"
  })
}

# Primary A record for main domain with failover routing
resource "aws_route53_record" "primary_a" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = local.domain_name
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.primary.id
  set_identifier  = "primary"
}

# Secondary A record for main domain with failover routing
resource "aws_route53_record" "primary_a_secondary" {
  provider = aws.dr
  zone_id  = aws_route53_zone.primary_zone.zone_id
  name     = local.domain_name
  type     = "A"

  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = aws_cloudfront_distribution.dr.domain_name
    zone_id                = aws_cloudfront_distribution.dr.hosted_zone_id
    evaluate_target_health = true
  }

  set_identifier = "secondary"
}

# API A record with latency-based routing for primary region
resource "aws_route53_record" "api_a_primary" {
  zone_id = aws_route53_zone.api_zone.zone_id
  name    = local.api_domain
  type    = "A"

  latency_routing_policy {
    region = data.aws_region.current.name
  }

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.api.id
  set_identifier  = "api-primary"
}

# API A record with latency-based routing for DR region
resource "aws_route53_record" "api_a_secondary" {
  provider = aws.dr
  zone_id  = aws_route53_zone.api_zone.zone_id
  name     = local.api_domain
  type     = "A"

  latency_routing_policy {
    region = "us-east-1"
  }

  alias {
    name                   = aws_lb.api_dr.dns_name
    zone_id                = aws_lb.api_dr.zone_id
    evaluate_target_health = true
  }

  set_identifier = "api-secondary"
}

# Data source for current AWS region
data "aws_region" "current" {}

# Data source for VPC
data "aws_vpc" "main" {
  tags = {
    Environment = terraform.workspace
    Project     = var.project_name
  }
}