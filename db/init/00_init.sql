-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('viewer', 'annotator', 'reviewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE batch_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE parse_status AS ENUM ('draft', 'approved', 'rejected', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE element_type AS ENUM ('table', 'figure');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Core tables
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status batch_status NOT NULL DEFAULT 'pending',
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash VARCHAR(64) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    official_run_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parse_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    status parse_status NOT NULL DEFAULT 'draft',
    task_state batch_status NOT NULL DEFAULT 'pending',
    raw_metadata JSONB NOT NULL DEFAULT '{}',
    error_msg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    annotated_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS parsed_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES parse_runs(id) ON DELETE CASCADE,
    omip_id VARCHAR(50),
    title TEXT,
    authors JSONB,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parse_runs_paper_status ON parse_runs(paper_id, status);

CREATE TABLE IF NOT EXISTS extracted_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES parse_runs(id) ON DELETE CASCADE,
    type element_type NOT NULL,
    label VARCHAR(50),
    caption TEXT,
    content JSONB NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint to ensure official_run_id is a valid parse_run
ALTER TABLE papers
    ADD CONSTRAINT fk_official_run FOREIGN KEY (official_run_id) REFERENCES parse_runs(id);

-- Optional minimal users table (for future auth extension)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
