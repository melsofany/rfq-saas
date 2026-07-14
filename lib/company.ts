import { pool } from '@/lib/db';

export type CompanySettings = {
  org_id: string;
  name_en: string | null;
  name_ar: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  currency: string | null;
  commercial_registration: string | null;
};

/** Load an org's branding/company info (Settings → Company). */
export async function getCompanySettings(orgId: string): Promise<CompanySettings | null> {
  const { rows } = await pool.query(
    `SELECT org_id, name_en, name_ar, logo_url, address, phone, email, tax_number, currency, commercial_registration
     FROM company_settings WHERE org_id = $1`,
    [orgId]
  );
  return rows[0] || null;
}
