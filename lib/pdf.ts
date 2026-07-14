import PDFDocument from 'pdfkit';
import type { CompanySettings } from '@/lib/company';

export interface RfqPdfItem {
  description: string;
  part_no?: string | null;
  qty?: number | string | null;
  uom?: string | null;
}

export interface RfqPdfInput {
  company: CompanySettings | null;
  rfq: {
    internal_rfq_no: string;
    customer_rfq_no?: string | null;
    required_response_date?: string | null;
    notes?: string | null;
  };
  items: RfqPdfItem[];
  supplierName?: string | null;
  offerLink: string;
}

async function fetchLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

/** Render a branded PDF summarizing an RFQ, for attaching to the email sent to a supplier. */
export async function generateRfqPdf(input: RfqPdfInput): Promise<Buffer> {
  const { company, rfq, items, supplierName, offerLink } = input;
  const logoBuffer = await fetchLogoBuffer(company?.logo_url);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const companyName = company?.name_en || company?.name_ar || 'Request for Quotation';

    // Header: logo + company info
    let headerBottom = 50;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 45, { width: 90 });
      } catch {
        /* ignore malformed image */
      }
    }
    doc
      .fontSize(18)
      .fillColor('#1a1a1a')
      .text(companyName, logoBuffer ? 160 : 50, 48, { align: 'left' });

    doc.fontSize(9).fillColor('#555555');
    let infoY = 72;
    const infoX = logoBuffer ? 160 : 50;
    if (company?.address) { doc.text(company.address, infoX, infoY); infoY += 13; }
    const contactLine = [company?.phone, company?.email].filter(Boolean).join('  ·  ');
    if (contactLine) { doc.text(contactLine, infoX, infoY); infoY += 13; }
    headerBottom = Math.max(infoY, 110);

    doc.moveTo(50, headerBottom + 10).lineTo(545, headerBottom + 10).strokeColor('#dddddd').stroke();

    // Title
    doc.moveDown(2);
    doc.fontSize(16).fillColor('#111111').text(`Request for Quotation — ${rfq.internal_rfq_no}`, 50, headerBottom + 25);

    doc.fontSize(10).fillColor('#333333');
    let y = headerBottom + 55;
    if (rfq.customer_rfq_no) { doc.text(`Customer RFQ No: ${rfq.customer_rfq_no}`, 50, y); y += 16; }
    if (rfq.required_response_date) {
      doc.text(`Response Required By: ${new Date(rfq.required_response_date).toLocaleDateString()}`, 50, y);
      y += 16;
    }
    if (supplierName) { doc.text(`Supplier: ${supplierName}`, 50, y); y += 16; }

    y += 10;

    // Items table
    const colX = { desc: 50, part: 250, qty: 380, uom: 450 };
    doc.fontSize(10).fillColor('#ffffff');
    doc.rect(50, y, 495, 20).fill('#2b3a55');
    doc.fillColor('#ffffff').text('Description', colX.desc + 5, y + 5, { width: 190 });
    doc.text('Part No', colX.part + 5, y + 5, { width: 120 });
    doc.text('Qty', colX.qty + 5, y + 5, { width: 60 });
    doc.text('UOM', colX.uom + 5, y + 5, { width: 80 });
    y += 20;

    doc.fillColor('#222222').fontSize(9.5);
    items.forEach((item, idx) => {
      const rowHeight = 20;
      if (y + rowHeight > 760) {
        doc.addPage();
        y = 50;
      }
      if (idx % 2 === 1) {
        doc.rect(50, y, 495, rowHeight).fill('#f5f6f8');
        doc.fillColor('#222222');
      }
      doc.text(item.description || '—', colX.desc + 5, y + 5, { width: 190 });
      doc.text(item.part_no || '—', colX.part + 5, y + 5, { width: 120 });
      doc.text(item.qty != null ? String(item.qty) : '—', colX.qty + 5, y + 5, { width: 60 });
      doc.text(item.uom || '—', colX.uom + 5, y + 5, { width: 80 });
      y += rowHeight;
    });

    y += 25;
    if (rfq.notes) {
      doc.fontSize(10).fillColor('#333333').text('Notes:', 50, y);
      y += 15;
      doc.fontSize(9.5).fillColor('#555555').text(rfq.notes, 50, y, { width: 495 });
      y += 40;
    }

    doc.fontSize(10).fillColor('#1a56db').text('Submit your offer online:', 50, y);
    y += 15;
    doc.fontSize(9.5).fillColor('#1a56db').text(offerLink, 50, y, { link: offerLink, underline: true, width: 495 });

    doc.end();
  });
}
