-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create partitioned benchmark data table
CREATE TABLE benchmark_data_partitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_id UUID NOT NULL REFERENCES metric_definitions(id),
    revenue_range_id UUID NOT NULL REFERENCES revenue_ranges(id),
    p10_value DECIMAL(20,5) NOT NULL CHECK (p10_value >= 0),
    p25_value DECIMAL(20,5) NOT NULL CHECK (p25_value >= p10_value),
    p50_value DECIMAL(20,5) NOT NULL CHECK (p50_value >= p25_value),
    p75_value DECIMAL(20,5) NOT NULL CHECK (p75_value >= p50_value),
    p90_value DECIMAL(20,5) NOT NULL CHECK (p90_value >= p75_value),
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    source VARCHAR(100) NOT NULL,
    collected_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (collected_at);

-- Create optimized indexes
CREATE INDEX idx_benchmark_lookup ON benchmark_data_partitions(metric_id, revenue_range_id, collected_at DESC);
CREATE INDEX idx_benchmark_time_range ON benchmark_data_partitions(collected_at) INCLUDE (metric_id, revenue_range_id);
CREATE INDEX idx_benchmark_source ON benchmark_data_partitions(source, collected_at);
CREATE INDEX idx_benchmark_metrics ON benchmark_data_partitions(metric_id) INCLUDE (p50_value, sample_size);

-- Create partition maintenance function
CREATE OR REPLACE FUNCTION fn_maintain_benchmark_partitions()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partitions for next 6 months
    FOR i IN 0..5 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' month')::INTERVAL);
        partition_name := 'benchmark_data_' || TO_CHAR(partition_date, 'YYYY_MM');
        
        -- Create partition if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF benchmark_data_partitions
                FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                partition_date,
                partition_date + INTERVAL '1 month'
            );
        END IF;
    END LOOP;

    -- Drop old partitions (older than 6 months)
    FOR partition_name IN
        SELECT c.relname 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname LIKE 'benchmark_data_%'
        AND TO_DATE(SPLIT_PART(c.relname, '_', 4) || '_' || SPLIT_PART(c.relname, '_', 3), 'MM_YYYY')
            < (CURRENT_DATE - INTERVAL '6 months')
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create benchmark trend analysis function
CREATE OR REPLACE FUNCTION fn_get_benchmark_trends(
    p_metric_id UUID,
    p_revenue_range_id UUID,
    p_months INTEGER
)
RETURNS TABLE (
    month_date DATE,
    p50_value DECIMAL(20,5),
    trend_direction VARCHAR(10),
    volatility DECIMAL(10,5),
    sample_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_stats AS (
        SELECT
            DATE_TRUNC('month', collected_at)::DATE AS month_date,
            p50_value,
            sample_size,
            LAG(p50_value) OVER (ORDER BY collected_at) AS prev_value,
            stddev(p50_value) OVER (
                ORDER BY collected_at
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ) AS rolling_stddev
        FROM benchmark_data_partitions
        WHERE metric_id = p_metric_id
        AND revenue_range_id = p_revenue_range_id
        AND collected_at >= CURRENT_DATE - (p_months || ' month')::INTERVAL
        ORDER BY collected_at
    )
    SELECT
        month_date,
        p50_value,
        CASE
            WHEN p50_value > prev_value THEN 'UP'
            WHEN p50_value < prev_value THEN 'DOWN'
            ELSE 'STABLE'
        END AS trend_direction,
        COALESCE(rolling_stddev, 0) AS volatility,
        sample_size
    FROM monthly_stats;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for latest benchmarks
CREATE MATERIALIZED VIEW mv_latest_benchmarks AS
SELECT
    metric_id,
    revenue_range_id,
    p10_value,
    p25_value,
    p50_value,
    p75_value,
    p90_value,
    sample_size,
    source,
    collected_at,
    stddev(p50_value) OVER (
        PARTITION BY metric_id, revenue_range_id
        ORDER BY collected_at
        ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) AS volatility
FROM benchmark_data_partitions
WHERE (metric_id, revenue_range_id, collected_at) IN (
    SELECT
        metric_id,
        revenue_range_id,
        MAX(collected_at)
    FROM benchmark_data_partitions
    GROUP BY metric_id, revenue_range_id
);

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_mv_latest_benchmarks 
ON mv_latest_benchmarks(metric_id, revenue_range_id);

-- Create partition maintenance trigger
CREATE OR REPLACE FUNCTION trg_benchmark_partition_maintenance()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM fn_maintain_benchmark_partitions();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintain_benchmark_partitions
    AFTER INSERT ON benchmark_data_partitions
    EXECUTE FUNCTION trg_benchmark_partition_maintenance();

-- Initial partition creation
SELECT fn_maintain_benchmark_partitions();