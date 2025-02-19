-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'USER');
CREATE TYPE "MetricType" AS ENUM ('FINANCIAL', 'GROWTH', 'OPERATIONAL', 'SALES');
CREATE TYPE "MetricUnit" AS ENUM ('CURRENCY', 'PERCENTAGE', 'RATIO', 'COUNT', 'DAYS', 'MONTHS');

-- Create users table with security features
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMPTZ,
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_email_check" CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create companies table with soft delete
CREATE TABLE "companies" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "revenueRangeId" UUID NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create metric definitions table
CREATE TABLE "metric_definitions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "type" "MetricType" NOT NULL,
    "unit" "MetricUnit" NOT NULL,
    "formula" TEXT NOT NULL,
    "validationRules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create metric values table with partitioning
CREATE TABLE "metric_values" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "metricId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (recordedAt);

-- Create benchmark data table with partitioning
CREATE TABLE "benchmark_data" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "metricId" UUID NOT NULL,
    "revenueRangeId" UUID NOT NULL,
    "p10Value" DOUBLE PRECISION NOT NULL,
    "p50Value" DOUBLE PRECISION NOT NULL,
    "p90Value" DOUBLE PRECISION NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "collectedAt" TIMESTAMPTZ NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (collectedAt);

-- Create sessions table for security
CREATE TABLE "sessions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL UNIQUE,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create audit logs table
CREATE TABLE "audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entityType" VARCHAR(255) NOT NULL,
    "entityId" UUID NOT NULL,
    "changes" JSONB,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT
);

-- Create optimized indexes
CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE INDEX "idx_users_company" ON "users" ("companyId");
CREATE INDEX "idx_users_role_active" ON "users" ("role") WHERE "isActive" = true;

CREATE INDEX "idx_companies_revenue_range" ON "companies" ("revenueRangeId");
CREATE INDEX "idx_companies_name" ON "companies" ("name");
CREATE INDEX "idx_companies_active" ON "companies" ("id") WHERE "isDeleted" = false;

CREATE INDEX "idx_metric_definitions_type" ON "metric_definitions" ("type");
CREATE INDEX "idx_metric_definitions_name" ON "metric_definitions" ("name");
CREATE INDEX "idx_metric_definitions_active" ON "metric_definitions" ("id") WHERE "isActive" = true;

CREATE INDEX "idx_metric_values_lookup" ON "metric_values" ("metricId", "companyId");
CREATE INDEX "idx_metric_values_time" ON "metric_values" ("recordedAt");

CREATE INDEX "idx_benchmark_data_lookup" ON "benchmark_data" ("metricId", "revenueRangeId");
CREATE INDEX "idx_benchmark_data_time" ON "benchmark_data" ("collectedAt");

CREATE INDEX "idx_sessions_user" ON "sessions" ("userId");
CREATE INDEX "idx_sessions_token" ON "sessions" ("token");
CREATE INDEX "idx_sessions_expiry" ON "sessions" ("expiresAt");

CREATE INDEX "idx_audit_logs_user" ON "audit_logs" ("userId");
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entityType", "entityId");
CREATE INDEX "idx_audit_logs_time" ON "audit_logs" ("timestamp");

-- Add foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "fk_users_company"
    FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE RESTRICT;

ALTER TABLE "metric_values" ADD CONSTRAINT "fk_metric_values_metric"
    FOREIGN KEY ("metricId") REFERENCES "metric_definitions" ("id") ON DELETE RESTRICT;
ALTER TABLE "metric_values" ADD CONSTRAINT "fk_metric_values_company"
    FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE RESTRICT;

ALTER TABLE "benchmark_data" ADD CONSTRAINT "fk_benchmark_data_metric"
    FOREIGN KEY ("metricId") REFERENCES "metric_definitions" ("id") ON DELETE RESTRICT;

ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_user"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_logs_user"
    FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT;

-- Create function for automated partition maintenance
CREATE OR REPLACE FUNCTION maintain_metric_partitions()
RETURNS void AS $$
BEGIN
    -- Create next month's partition if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS metric_values_%s PARTITION OF metric_values
        FOR VALUES FROM (%L) TO (%L)',
        to_char(date_trunc('month', now() + interval '1 month'), 'YYYY_MM'),
        date_trunc('month', now() + interval '1 month'),
        date_trunc('month', now() + interval '2 month')
    );
    
    -- Create next month's benchmark partition
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS benchmark_data_%s PARTITION OF benchmark_data
        FOR VALUES FROM (%L) TO (%L)',
        to_char(date_trunc('month', now() + interval '1 month'), 'YYYY_MM'),
        date_trunc('month', now() + interval '1 month'),
        date_trunc('month', now() + interval '2 month')
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to all tables
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_companies_timestamp
    BEFORE UPDATE ON "companies"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_metric_definitions_timestamp
    BEFORE UPDATE ON "metric_definitions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sessions_timestamp
    BEFORE UPDATE ON "sessions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();