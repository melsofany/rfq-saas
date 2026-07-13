-- Migration 003: Single-session enforcement
-- Adds active_session_token to org_users to allow only one active session per user

ALTER TABLE org_users ADD COLUMN IF NOT EXISTS active_session_token text;
