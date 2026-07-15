-- Migration 008: Unified RFQ Status Workflow
-- Remaps legacy lowercase status values to the new uppercase workflow values.
-- Adds rfq_id to purchase_orders so PO creation can mark the originating RFQ as SUCCESS.

-- 1. Remap existing rfq rows to the new canonical values (no data loss)
UPDATE rfqs SET status = 'DRAFT'   WHERE status = 'draft';
UPDATE rfqs SET status = 'SENT'    WHERE status = 'sent';
UPDATE rfqs SET status = 'QUOTED'  WHERE status = 'partial';
UPDATE rfqs SET status = 'SUCCESS' WHERE status = 'completed';
UPDATE rfqs SET status = 'FAILED'  WHERE status = 'closed';

-- 2. Change column default to new value
ALTER TABLE rfqs ALTER COLUMN status SET DEFAULT 'DRAFT';

-- 3. Add rfq_id to purchase_orders (nullable; only populated when PO is created from an RFQ offer)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rfq_id uuid REFERENCES rfqs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_po_rfq ON purchase_orders(rfq_id) WHERE rfq_id IS NOT NULL;
