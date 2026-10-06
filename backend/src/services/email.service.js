const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Email Notification Service
 * Sends transactional email alerts (dev utilizes Ethereal SMTP with console preview).
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initPromise = this._initTransporter();
  }

  async _initTransporter() {
    if (env.IS_PRODUCTION && process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Create Ethereal test account or JSON transport
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 5887,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        logger.info(`Ethereal test SMTP initialized: ${testAccount.user}`);
      } catch {
        // Fallback to JSON transport
        this.transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }
  }

  /**
   * Send notification email.
   */
  async sendEmail({ to, subject, html, text }) {
    await this.initPromise;
    if (!this.transporter) return;

    try {
      const info = await this.transporter.sendMail({
        from: '"SecureWork Verify" <no-reply@securework.io>',
        to,
        subject,
        text,
        html
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`[Email Preview]: ${previewUrl}`);
      }
      return info;
    } catch (err) {
      logger.warn(`Email sending failed: ${err.message}`);
    }
  }

  async sendCredentialIssuedEmail(recipientEmail, recipientName, credentialTitle, verifyUrl) {
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 8px;">
        <h2 style="color: #38bdf8;">SecureWork Verify — New Credential Issued</h2>
        <p>Hello <strong>${recipientName}</strong>,</p>
        <p>A new cryptographically verifiable credential has been issued to your portfolio:</p>
        <div style="background-color: #1e293b; padding: 16px; border-radius: 6px; border-left: 4px solid #06b6d4; margin: 16px 0;">
          <h3 style="margin: 0; color: #f8fafc;">${credentialTitle}</h3>
        </div>
        <p>You can view and verify your credential certificate online:</p>
        <a href="${verifyUrl}" style="background-color: #06b6d4; color: #000; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Public Certificate</a>
      </div>
    `;
    return this.sendEmail({
      to: recipientEmail,
      subject: `New Credential Issued: ${credentialTitle}`,
      text: `Hello ${recipientName}, a new credential (${credentialTitle}) was issued to you. Verify at: ${verifyUrl}`,
      html
    });
  }

  async sendCredentialVerifiedEmail(recipientEmail, recipientName, credentialTitle, verifierInfo) {
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 8px;">
        <h2 style="color: #10b981;">Credential Verification Completed</h2>
        <p>Hello <strong>${recipientName}</strong>,</p>
        <p>Your credential <strong>${credentialTitle}</strong> was recently submitted for verification by <strong>${verifierInfo}</strong>.</p>
        <p>Verification Status: <span style="color: #10b981; font-weight: bold;">CRYPTOGRAPHICALLY VALID</span></p>
      </div>
    `;
    return this.sendEmail({
      to: recipientEmail,
      subject: `Credential Verified: ${credentialTitle}`,
      text: `Your credential ${credentialTitle} was successfully verified by ${verifierInfo}.`,
      html
    });
  }
}

module.exports = new EmailService();
