import nodemailer from 'nodemailer';
import { pool } from '@/lib/db';

export type OrgSmtpSettings = {
  org_id: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
};

/** Load the SMTP credentials an org saved in Settings → Sensitive Data. */
export async function getOrgSmtpSettings(orgId: string): Promise<OrgSmtpSettings | null> {
  const { rows } = await pool.query(
    `SELECT org_id, smtp_host, smtp_port, smtp_user, smtp_pass
     FROM org_integrations WHERE org_id = $1`,
    [orgId]
  );
  return rows[0] || null;
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

/** Send an email on behalf of an org using its saved SMTP settings. */
export async function sendOrgEmail(
  orgId: string,
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
): Promise<{ messageId: string }> {
  const settings = await getOrgSmtpSettings(orgId);
  if (!settings || !settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    throw new Error('Email (SMTP) is not configured for this organization yet (Settings → Sensitive Data).');
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: (settings.smtp_port || 587) === 465,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });

  const info = await transporter.sendMail({
    from: settings.smtp_user,
    to,
    subject,
    html,
    attachments,
  });

  return { messageId: info.messageId };
}
