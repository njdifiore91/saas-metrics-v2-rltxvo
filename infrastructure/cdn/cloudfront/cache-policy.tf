# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Import AWS region from variables
variable "aws_region" {
  type        = string
  description = "Primary AWS region for resource deployment"
}

# Cache policy for static content (HTML, CSS, JS, images)
resource "aws_cloudfront_cache_policy" "main" {
  name        = "startup-metrics-cache-policy"
  comment     = "Cache policy for Startup Metrics Benchmarking Platform static content"
  default_ttl = 86400    # 24 hours default TTL
  max_ttl     = 31536000 # 1 year maximum TTL
  min_ttl     = 1        # 1 second minimum TTL

  parameters_in_cache_key_and_forwarded_to_origin {
    # Don't cache based on cookies for static content
    cookies_config {
      cookie_behavior = "none"
    }

    # Include CORS-related headers in cache key
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = [
          "Origin",
          "Access-Control-Request-Method",
          "Access-Control-Request-Headers"
        ]
      }
    }

    # Don't cache based on query strings for static content
    query_strings_config {
      query_string_behavior = "none"
    }

    # Enable compression support
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache policy for API responses
resource "aws_cloudfront_cache_policy" "api" {
  name        = "startup-metrics-api-cache-policy"
  comment     = "Cache policy for Startup Metrics API responses with dynamic content"
  default_ttl = 900  # 15 minutes default TTL for API responses
  max_ttl     = 3600 # 1 hour maximum TTL
  min_ttl     = 0    # No minimum TTL for API responses

  parameters_in_cache_key_and_forwarded_to_origin {
    # Don't cache based on cookies for API responses
    cookies_config {
      cookie_behavior = "none"
    }

    # Include authentication and CORS headers in cache key
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = [
          "Authorization",
          "Origin",
          "Access-Control-Request-Method",
          "Access-Control-Request-Headers"
        ]
      }
    }

    # Cache based on all query string parameters
    query_strings_config {
      query_string_behavior = "all"
    }

    # Enable compression support
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}