# Configure AWS Route53 DNS records for the Startup Metrics Benchmarking Platform
# Provider: hashicorp/aws ~> 4.0

# Primary API endpoint health check with enhanced monitoring
resource "aws_route53_health_check" "primary_api" {
  fqdn                    = var.primary_api_endpoint
  port                    = 443
  type                    = "HTTPS"
  resource_path          = "/health"
  failure_threshold      = "3"
  request_interval       = "30"
  search_string         = "healthy"
  enable_sni            = true
  
  regions = [
    "us-west-1",
    "us-east-1",
    "eu-west-1"
  ]
  
  measure_latency = true
  
  tags = local.zone_tags
}

# Main domain A record pointing to CloudFront distribution
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = "www"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# Primary API record with failover routing
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.api_zone.zone_id
  name    = "api"
  type    = "A"
  ttl     = 60
  
  failover_routing_policy {
    type = "PRIMARY"
  }
  
  health_check_id = aws_route53_health_check.primary_api.id
  set_identifier  = "primary"
  
  records = [var.primary_api_endpoint]
}

# Secondary API record for failover
resource "aws_route53_record" "api_secondary" {
  zone_id = aws_route53_zone.api_zone.zone_id
  name    = "api"
  type    = "A"
  ttl     = 60
  
  failover_routing_policy {
    type = "SECONDARY"
  }
  
  set_identifier = "secondary"
  
  records = [var.secondary_api_endpoint]
}

# CNAME record for metrics subdomain
resource "aws_route53_record" "metrics" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = "metrics"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.main.domain_name]
}

# TXT record for domain verification
resource "aws_route53_record" "domain_verification" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = ""
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:_spf.google.com ~all"]
}

# MX records for Google Workspace email
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = ""
  type    = "MX"
  ttl     = 3600
  records = [
    "1 ASPMX.L.GOOGLE.COM",
    "5 ALT1.ASPMX.L.GOOGLE.COM",
    "5 ALT2.ASPMX.L.GOOGLE.COM",
    "10 ALT3.ASPMX.L.GOOGLE.COM",
    "10 ALT4.ASPMX.L.GOOGLE.COM"
  ]
}

# CAA records for SSL certificate authorities
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = ""
  type    = "CAA"
  ttl     = 300
  records = [
    "0 issue \"amazon.com\"",
    "0 issue \"letsencrypt.org\"",
    "0 issuewild \"amazon.com\""
  ]
}

# DMARC record for email authentication
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = "_dmarc"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc@${aws_route53_zone.primary_zone.name}"]
}

# Monitoring records for health check endpoints
resource "aws_route53_record" "health" {
  zone_id = aws_route53_zone.primary_zone.zone_id
  name    = "health"
  type    = "A"
  ttl     = 60
  records = [var.primary_api_endpoint]
}

# Monitoring records for API health check endpoints
resource "aws_route53_record" "api_health" {
  zone_id = aws_route53_zone.api_zone.zone_id
  name    = "health"
  type    = "A"
  ttl     = 60
  records = [var.primary_api_endpoint]
}