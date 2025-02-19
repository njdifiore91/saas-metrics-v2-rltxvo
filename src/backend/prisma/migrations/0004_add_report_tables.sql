-- Migration: Add Report Tables
-- Description: Creates and configures report-related tables with enhanced security and performance features
-- PostgreSQL Version: 14+

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create report_templates table
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('standard', 'custom', 'system')),
    description TEXT,
    schema JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES report_templates(id),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    data JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

-- Create report_sections table
CREATE TABLE report_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('metrics', 'chart', 'table', 'text')),
    content JSONB NOT NULL DEFAULT '{}',
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create report_exports table
CREATE TABLE report_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    format VARCHAR(50) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path VARCHAR(1024),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

-- Create report_audit_log table
CREATE TABLE report_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'archived', 'exported')),
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255)
);

-- Create indexes for performance optimization
CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_template ON reports(template_id);
CREATE INDEX idx_reports_status ON reports(status) WHERE status != 'archived';
CREATE INDEX idx_reports_dates ON reports(created_at, archived_at);
CREATE INDEX idx_reports_version ON reports(id, version);

CREATE INDEX idx_templates_type ON report_templates(type) WHERE is_active = true;
CREATE INDEX idx_templates_active ON report_templates(is_active);

CREATE INDEX idx_sections_report ON report_sections(report_id);
CREATE INDEX idx_sections_order ON report_sections(report_id, order_index);

CREATE INDEX idx_exports_report ON report_exports(report_id);
CREATE INDEX idx_exports_user ON report_exports(user_id);
CREATE INDEX idx_exports_status ON report_exports(status) WHERE status IN ('pending', 'processing');

CREATE INDEX idx_audit_report ON report_audit_log(report_id);
CREATE INDEX idx_audit_user ON report_audit_log(user_id);
CREATE INDEX idx_audit_created ON report_audit_log(created_at);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_report_timestamp
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_template_timestamp
    BEFORE UPDATE ON report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_section_timestamp
    BEFORE UPDATE ON report_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create trigger for audit logging
CREATE OR REPLACE FUNCTION audit_report_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO report_audit_log (report_id, user_id, action, changes)
        VALUES (NEW.id, NEW.user_id, 'created', to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status != OLD.status THEN
            INSERT INTO report_audit_log (report_id, user_id, action, changes)
            VALUES (NEW.id, NEW.user_id, 
                   CASE WHEN NEW.status = 'archived' THEN 'archived' ELSE 'updated' END,
                   jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
        END IF;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_report_changes
    AFTER INSERT OR UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION audit_report_changes();

-- Add comments for documentation
COMMENT ON TABLE reports IS 'Stores report instances created by users';
COMMENT ON TABLE report_templates IS 'Defines report templates for different report types';
COMMENT ON TABLE report_sections IS 'Contains individual sections within reports';
COMMENT ON TABLE report_exports IS 'Tracks report export requests and their status';
COMMENT ON TABLE report_audit_log IS 'Maintains audit trail of all report-related actions';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON reports TO app_user;
GRANT SELECT, INSERT ON report_audit_log TO app_user;
GRANT SELECT ON report_templates TO app_user;
GRANT SELECT, INSERT, UPDATE ON report_sections TO app_user;
GRANT SELECT, INSERT, UPDATE ON report_exports TO app_user;