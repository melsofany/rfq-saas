-- ═══════════════════════════════════════════════════════════════════
-- Migration 008 — Supplier & Employee Ratings
-- ═══════════════════════════════════════════════════════════════════

-- ── Supplier Ratings ──────────────────────────────────────────────
-- Each row is one evaluation of a supplier.
-- Criteria are scored 1-5; overall_score is the average of all criteria.

CREATE TABLE IF NOT EXISTS supplier_ratings (
  id            uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id   uuid       NOT NULL REFERENCES suppliers(id)     ON DELETE CASCADE,
  rated_by      uuid       REFERENCES organization_members(id),
  rfq_id        uuid       REFERENCES rfqs(id),
  po_id         uuid       REFERENCES purchase_orders(id),

  -- Evaluation criteria (1 = Poor … 5 = Excellent)
  price_score         smallint NOT NULL CHECK (price_score        BETWEEN 1 AND 5),
  delivery_score      smallint NOT NULL CHECK (delivery_score     BETWEEN 1 AND 5),
  quality_score       smallint NOT NULL CHECK (quality_score      BETWEEN 1 AND 5),
  communication_score smallint NOT NULL CHECK (communication_score BETWEEN 1 AND 5),
  compliance_score    smallint NOT NULL CHECK (compliance_score   BETWEEN 1 AND 5),

  -- Average of all five criteria (stored for fast ordering/filtering)
  overall_score numeric(3,2) NOT NULL DEFAULT 0,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_ratings_org      ON supplier_ratings(org_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_supplier ON supplier_ratings(supplier_id);

-- ── Employee Ratings ──────────────────────────────────────────────
-- Each row is one periodic evaluation of a team member.
-- period_label is a free-text label such as "Q1 2025" or "July 2025".

CREATE TABLE IF NOT EXISTS employee_ratings (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organizations(id)           ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES organization_members(id)   ON DELETE CASCADE,
  rated_by  uuid REFERENCES organization_members(id),
  period_label text,   -- e.g. "Q2 2025", "July 2025"

  -- Evaluation criteria (1 = Poor … 5 = Excellent)
  work_quality_score  smallint NOT NULL CHECK (work_quality_score  BETWEEN 1 AND 5),
  timeliness_score    smallint NOT NULL CHECK (timeliness_score    BETWEEN 1 AND 5),
  teamwork_score      smallint NOT NULL CHECK (teamwork_score      BETWEEN 1 AND 5),
  initiative_score    smallint NOT NULL CHECK (initiative_score    BETWEEN 1 AND 5),
  communication_score smallint NOT NULL CHECK (communication_score BETWEEN 1 AND 5),

  -- Average of all five criteria
  overall_score numeric(3,2) NOT NULL DEFAULT 0,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_ratings_org    ON employee_ratings(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_ratings_member ON employee_ratings(member_id);
