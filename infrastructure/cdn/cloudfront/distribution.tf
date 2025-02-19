# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Main CloudFront distribution for the Startup Metrics Platform
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled    = true
  comment            = "Distribution for Startup Metrics Benchmarking Platform"
  default_root_object = "index.html"
  price_class        = "PriceClass_All"
  http_version       = "http2and3"
  web_acl_id         = "${aws_wafv2_web_acl.main.id}"
  aliases            = ["metrics.startup.com"]

  # Origin configuration for S3 web bucket
  origin {
    domain_name = "${aws_s3_bucket.web.bucket_regional_domain_name}"
    origin_id   = "web-app"

    s3_origin_config {
      origin_access_identity = "${aws_cloudfront_origin_access_identity.web.cloudfront_access_identity_path}"
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = "${random_string.origin_verify.result}"
    }
  }

  # Default cache behavior for web application
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "web-app"

    viewer_protocol_policy     = "redirect-to-https"
    cache_policy_id           = "${aws_cloudfront_cache_policy.main.id}"
    compress                  = true
    response_headers_policy_id = "${aws_cloudfront_response_headers_policy.security_headers.id}"
  }

  # Custom error responses for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 10
  }

  # Geographic restrictions (none)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = "${aws_acm_certificate.cdn.arn}"
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

  # Access logging configuration
  logging_config {
    include_cookies = false
    bucket         = "${aws_s3_bucket.logs.bucket_domain_name}"
    prefix         = "cloudfront/"
    retention_in_days = 90
  }

  # Resource tags
  tags = {
    Environment = "${var.environment}"
    Project     = "startup-metrics"
    ManagedBy   = "terraform"
  }
}