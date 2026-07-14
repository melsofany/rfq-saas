-- ═══════════════════════════════════════════════════════════════════
-- Migration 005 — Employee details on organization_members
-- (full name, phone, email stored per-membership so the Employees page
--  can create + list members without extra joins)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS phone text;

-- Backfill from org_users for any existing rows
UPDATE organization_members m
SET email = u.email,
    full_name = COALESCE(m.full_name, u.full_name)
FROM org_users u
WHERE m.user_id = u.id AND m.email IS NULL;
