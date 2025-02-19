-- PostgreSQL 14.0 Migration
-- Add core metrics tables with time-based partitioning and data integrity controls

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create revenue ranges table
CREATE TABLE revenue_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    min_revenue DECIMAL(20,2) NOT NULL,
    max_revenue DECIMAL(20,2) NOT NULL,
    CONSTRAINT check_revenue_range CHECK (min_revenue < max_revenue)
);

-- Create indexes for revenue ranges
CREATE INDEX idx_revenue_ranges_range ON revenue_ranges(min_revenue, max_revenue);
CREATE UNIQUE INDEX idx_revenue_ranges_boundaries ON revenue_ranges(min_revenue, max_revenue);

-- Create companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    revenue_range_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_companies_revenue_range 
        FOREIGN KEY (revenue_range_id) 
        REFERENCES revenue_ranges(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for companies
CREATE INDEX idx_companies_revenue_range ON companies(revenue_range_id);
CREATE INDEX idx_companies_created_at ON companies(created_at);
CREATE INDEX idx_companies_updated_at ON companies(updated_at);

-- Create partitioned metric values table
CREATE TABLE metric_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    metric_id UUID NOT NULL,
    value DECIMAL(20,5) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_metric_values_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_metric_values_metric
        FOREIGN KEY (metric_id)
        REFERENCES metric_definitions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) PARTITION BY RANGE (recorded_at);

-- Create indexes for metric values
CREATE INDEX idx_metric_values_lookup ON metric_values(company_id, metric_id);
CREATE INDEX idx_metric_values_recorded_at ON metric_values(recorded_at);
CREATE INDEX idx_metric_values_company_time ON metric_values(company_id, recorded_at);

-- Create initial partitions for metric values (5 years retention)
DO $$
BEGIN
    FOR y IN 2023..2027 LOOP
        FOR m IN 1..12 LOOP
            EXECUTE format(
                'CREATE TABLE metric_values_y%sm%s PARTITION OF metric_values
                FOR VALUES FROM (%L) TO (%L)',
                y, 
                LPAD(m::text, 2, '0'),
                format('%s-%s-01', y, LPAD(m::text, 2, '0')),
                format('%s-%s-01', 
                    CASE WHEN m = 12 THEN y + 1 ELSE y END,
                    CASE WHEN m = 12 THEN '01' ELSE LPAD((m + 1)::text, 2, '0') END
                )
            );
        END LOOP;
    END LOOP;
END $$;

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintaining updated_at timestamps
CREATE TRIGGER set_company_timestamp
    BEFORE UPDATE ON companies
    FOR EACH ROW
    WHEN (NEW.* IS DISTINCT FROM OLD.*)
    EXECUTE FUNCTION update_updated_at();

-- Create function for validating revenue range boundaries
CREATE OR REPLACE FUNCTION validate_revenue_boundaries()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM revenue_ranges
        WHERE (NEW.min_revenue BETWEEN min_revenue AND max_revenue
            OR NEW.max_revenue BETWEEN min_revenue AND max_revenue)
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Revenue ranges cannot overlap';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validating revenue ranges
CREATE TRIGGER validate_revenue_range
    BEFORE INSERT OR UPDATE ON revenue_ranges
    FOR EACH ROW
    EXECUTE FUNCTION validate_revenue_boundaries();

-- Create maintenance function for partition management
CREATE OR REPLACE FUNCTION maintain_metric_value_partitions()
RETURNS void AS $$
DECLARE
    next_partition_date DATE;
    partition_name TEXT;
BEGIN
    -- Create next month's partition if it doesn't exist
    next_partition_date := date_trunc('month', now()) + interval '2 month';
    partition_name := format('metric_values_y%sm%s',
        date_part('year', next_partition_date),
        LPAD(date_part('month', next_partition_date)::text, 2, '0')
    );
    
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF metric_values
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            date_trunc('month', next_partition_date),
            date_trunc('month', next_partition_date + interval '1 month')
        );
    END IF;
    
    -- Drop partitions older than retention period
    FOR partition_name IN (
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname LIKE 'metric_values_y%'
        AND c.relname < format('metric_values_y%sm%s',
            date_part('year', now() - interval '5 years'),
            LPAD(date_part('month', now() - interval '5 years')::text, 2, '0')
        )
    ) LOOP
        EXECUTE format('DROP TABLE %I', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job for partition maintenance (requires pg_cron extension)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.schedule('0 0 1 * *', $$
            SELECT maintain_metric_value_partitions();
        $$);
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE revenue_ranges IS 'Defines revenue range categories for company classification';
COMMENT ON TABLE companies IS 'Stores company information with revenue range classification';
COMMENT ON TABLE metric_values IS 'Stores company metric values with time-based partitioning';
COMMENT ON FUNCTION update_updated_at() IS 'Automatically updates the updated_at timestamp';
COMMENT ON FUNCTION validate_revenue_boundaries() IS 'Ensures revenue ranges do not overlap';
COMMENT ON FUNCTION maintain_metric_value_partitions() IS 'Maintains metric value partitions for 5-year retention';