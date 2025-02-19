# Configure Terraform settings and required providers
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
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Primary AWS provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "startup-metrics"
      Environment = terraform.workspace
      ManagedBy   = "terraform"
    }
  }
}

# Secondary AWS provider for disaster recovery region
provider "aws" {
  alias  = "dr"
  region = "us-east-1" # Secondary region for disaster recovery

  default_tags {
    tags = {
      Project     = "startup-metrics"
      Environment = terraform.workspace
      ManagedBy   = "terraform"
      Type        = "disaster-recovery"
    }
  }
}

# Kubernetes provider configuration for EKS cluster
provider "kubernetes" {
  host                   = data.eks_cluster_endpoint.endpoint
  cluster_ca_certificate = base64decode(data.eks_cluster_endpoint.certificate_authority)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      local.cluster_name
    ]
  }

  # Set timeout for Kubernetes operations
  timeout = "30m"
}

# Helm provider configuration for Kubernetes deployments
provider "helm" {
  kubernetes {
    host                   = data.eks_cluster_endpoint.endpoint
    cluster_ca_certificate = base64decode(data.eks_cluster_endpoint.certificate_authority)
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        local.cluster_name
      ]
    }
  }

  # Configure Helm repository settings
  repository_config_path = "${path.module}/.helm/repositories.yaml"
  repository_cache      = "${path.module}/.helm/cache"
}

# Local variables
locals {
  cluster_name = "${var.project_name}-${terraform.workspace}"
}