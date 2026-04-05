-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Row Level Security
ALTER DATABASE nexusos_dev SET session_preload_libraries = 'pgaudit';

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit.trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit.logged_actions (table_name, schema_name, action_performed, old_row, new_row, user_name, action_timestamp)
    VALUES (TG_TABLE_NAME, TG_TABLE_SCHEMA, 'DELETE', OLD, NULL, current_user, now());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit.logged_actions (table_name, schema_name, action_performed, old_row, new_row, user_name, action_timestamp)
    VALUES (TG_TABLE_NAME, TG_TABLE_SCHEMA, 'UPDATE', OLD, NEW, current_user, now());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit.logged_actions (table_name, schema_name, action_performed, old_row, new_row, user_name, action_timestamp)
    VALUES (TG_TABLE_NAME, TG_TABLE_SCHEMA, 'INSERT', NULL, NEW, current_user, now());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit.logged_actions (
  id SERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL DEFAULT (txid_current()::bigint),
  table_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  action_performed TEXT NOT NULL,
  old_row JSONB,
  new_row JSONB,
  user_name TEXT,
  action_timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_timestamp ON audit.logged_actions(action_timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_table ON audit.logged_actions(table_name, action_timestamp DESC);

-- Disable RLS for audit tables
ALTER TABLE audit.logged_actions ENABLE ROW LEVEL SECURITY;