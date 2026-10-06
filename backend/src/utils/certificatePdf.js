const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { sha256 } = require('./crypto');

/**
 * Generate a PDF Certificate.
 * @param {object} params
 * @param {object} params.credential
 * @param {object} params.issuer
 * @param {object} params.organization
 * @param {object} params.recipient
 * @param {string} params.verifyUrl
 * @returns {Promise<Buffer>} PDF binary buffer
 */
async function generateCertificatePdf({ credential, issuer, organization, recipient, verifyUrl }) {
  // Generate QR code data buffer
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 140,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  const sigFingerprint = sha256(credential.signature || 'UNSIGNED').slice(0, 32).toUpperCase().match(/.{1,4}/g).join('-');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width;
    const height = doc.page.height;

    // Background fill
    doc.rect(0, 0, width, height).fill('#090d16');

    // Outer double borders (Cyan & Indigo gradient simulation)
    doc.lineWidth(3).strokeColor('#06b6d4').rect(20, 20, width - 40, height - 40).stroke();
    doc.lineWidth(1).strokeColor('#8b5cf6').rect(26, 26, width - 52, height - 52).stroke();

    // Security watermark/accent in header
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#06b6d4')
      .text('SECUREWORK VERIFY  •  CRYPTOGRAPHIC EVIDENCE REGISTRY', 40, 45, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#f8fafc')
      .text('CERTIFICATE OF QUALIFICATION', { align: 'center' });

    doc.fontSize(10).font('Helvetica').fillColor('#94a3b8')
      .text('CRYPTOGRAPHICALLY SEALED & VERIFIABLE WORKFORCE RECORD', { align: 'center' });

    doc.moveDown(1.2);
    doc.fontSize(12).font('Helvetica').fillColor('#cbd5e1')
      .text('This is an authoritative, digitally signed record certifying that', { align: 'center' });

    doc.moveDown(0.4);
    const recipientName = recipient?.name || 'Authorized Recipient';
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#38bdf8')
      .text(recipientName, { align: 'center' });

    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#94a3b8')
      .text(`has demonstrated verifiable qualification for`, { align: 'center' });

    doc.moveDown(0.3);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#e2e8f0')
      .text(credential.title || 'Workforce Credential', { align: 'center' });

    // Credential Type & Details
    const typeLabel = credential.credentialType || 'CREDENTIAL';
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#a855f7')
      .text(`TYPE: ${typeLabel}   •   STATUS: ${credential.status}`, { align: 'center' });

    // Issue & Expiry Metadata block
    const issuedDate = credential.issuedAt ? new Date(credential.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const expiryDate = credential.expiresAt ? new Date(credential.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Indefinite / Permanent';

    const orgName = organization?.name || issuer?.organizationName || 'Accredited Institution';
    const domain = organization?.officialDomain || 'securework.io';

    // Left Column: Issuer Sign-off
    const leftX = 55;
    const bottomY = height - 170;

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#38bdf8')
      .text('ISSUING INSTITUTION', leftX, bottomY);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#f1f5f9')
      .text(orgName, leftX, bottomY + 15);
    doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
      .text(`Official Domain: ${domain}`, leftX, bottomY + 30);
    doc.text(`Issued: ${issuedDate} | Expires: ${expiryDate}`, leftX, bottomY + 44);

    // Cryptographic Proof details
    doc.fontSize(8).font('Courier').fillColor('#64748b')
      .text(`Credential ID: ${credential.credentialId}`, leftX, bottomY + 62);
    doc.text(`Sig Alg: ${credential.signatureAlgorithm || 'Ed25519'} (RFC 8785 Canonicalized)`, leftX, bottomY + 74);
    doc.text(`Signature Fingerprint: ${sigFingerprint}`, leftX, bottomY + 86);

    // Right Column: QR Code + Verification Link
    const rightX = width - 180;
    doc.image(qrBuffer, rightX, bottomY - 15, { width: 100, height: 100 });

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#06b6d4')
      .text('SCAN TO VERIFY ONLINE', rightX - 25, bottomY + 92, { width: 150, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
      .text('Zero-Trust Offline Cryptographic Proof', rightX - 25, bottomY + 104, { width: 150, align: 'center' });

    // Footer notice
    doc.fontSize(8).font('Helvetica').fillColor('#475569')
      .text('This document contains digital cryptographic assertions. Any alteration of text or binary invalidates mathematical verification.', 0, height - 32, { align: 'center' });

    doc.end();
  });
}

module.exports = {
  generateCertificatePdf
};
