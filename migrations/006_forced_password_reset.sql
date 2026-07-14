-- ═══════════════════════════════════════════════════════════════════
-- Migration 006 — Forced password reset flag
-- When an admin resets an employee's password, the employee must set
-- their own new password on next login before they can use the app.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE org_users ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;
