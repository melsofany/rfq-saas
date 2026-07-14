-- ═══════════════════════════════════════════════════════════════════
-- Migration 007 — Customer RFQ No becomes optional
-- The "Customer RFQ No" field is now optional in the New RFQ form,
-- so the column must allow NULL.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE rfqs ALTER COLUMN customer_rfq_no DROP NOT NULL;
