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
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
        auth: { user: smtpUser, pass: smtpPass }
      });
      try {
        await this.transporter.verify();
        logger.info(`[EmailService] Real SMTP transporter initialized for ${smtpUser}`);
      } catch (err) {
        logger.warn(`[EmailService] SMTP verification failed for ${smtpUser}: ${err.message}; using JSON fallback.`);
        this.transporter = nodemailer.createTransport({ jsonTransport: true });
        logger.info('[EmailService] Fallback JSON transport initialized.');
      }
    } else {
      // Keep local startup independent of external test SMTP account provisioning.
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      logger.info('[EmailService] SMTP credentials missing; using in-memory JSON fallback transport.');
    }
  }

  /**
   * Send notification email.
   */
  async sendEmail({ from, to, subject, html, text }) {
    await this.initPromise;
    if (!this.transporter) return;
    const sender = from || process.env.SMTP_FROM || process.env.SMTP_USER || '"SecureWork Verify" <no-reply@securework.io>';

    try {
      const info = await this.transporter.sendMail({
        from: sender,
        to,
        subject,
        text,
        html
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`[Email Preview]: ${previewUrl}`);
      } else if (this.transporter.options?.jsonTransport) {
        logger.info('[Email JSON transport]', { to, subject });
      }
      return info;
    } catch (err) {
      logger.warn(`Email sending failed: ${err.message}`);
      // If not already using JSON transport, fallback and retry once
      if (!this.transporter || (this.transporter.options && !this.transporter.options.jsonTransport)) {
        this.transporter = nodemailer.createTransport({ jsonTransport: true });
        try {
          const retryInfo = await this.transporter.sendMail({
            from: sender,
            to,
            subject,
            text,
            html
          });
          const previewUrl = nodemailer.getTestMessageUrl(retryInfo);
          if (previewUrl) {
            logger.info(`[Email Preview after fallback]: ${previewUrl}`);
          }
          return retryInfo;
        } catch (fallbackErr) {
          logger.warn(`Fallback JSON email also failed: ${fallbackErr.message}`);
        }
      }
    }
  }

  async sendOrganizationInvitation({ email, name, organizationName, inviteToken, role }) {
    const frontendUrl = (process.env.FRONTEND_URL || env.FRONTEND_URL).replace(/\/+$/, '');
    const registrationUrl = `${frontendUrl}/register?token=${encodeURIComponent(inviteToken)}`;
    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    const safeName = escapeHtml(name || 'there');
    const safeOrganization = escapeHtml(organizationName);
    const safeRole = escapeHtml(role);
    const html = `
      <div style="font-family: Arial, sans-serif; background:#0b1120; color:#e2e8f0; padding:32px; border-radius:12px; max-width:600px; margin:auto;">
        <div style="border:1px solid rgba(139,92,246,.45); background:#111827; padding:28px; border-radius:10px;">
          <p style="color:#a78bfa; letter-spacing:2px; font-size:12px; font-weight:bold;">SECUREWORK VERIFY</p>
          <h1 style="color:#f8fafc; font-size:24px;">You’re invited to join ${safeOrganization}</h1>
          <p>Hello ${safeName},</p>
          <p>You have been invited to ${safeOrganization} as an <strong style="color:#34d399;">${safeRole}</strong>.</p>
          <p>Complete your account setup using the secure invitation link below. This link expires in 7 days.</p>
          <a href="${registrationUrl}" style="background:#8b5cf6; color:#fff; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Accept Invitation</a>
          <p style="color:#94a3b8; font-size:12px; margin-top:24px;">If you were not expecting this invitation, you can ignore this email.</p>
        </div>
      </div>
    `;
    const info = await this.sendEmail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || '"SecureWork Verify" <no-reply@securework.io>',
      to: email,
      subject: `Invitation to join ${organizationName} on SecureWork Verify`,
      text: `Hello ${name || 'there'}, you have been invited to join ${organizationName} as ${role}. Complete registration at ${registrationUrl}. This link expires in 7 days.`,
      html
    });
    if (!info) return { success: false, messageId: null };
    return { success: true, messageId: info.messageId };
  }

  async sendCredentialIssuedEmail(recipientEmailOrUser, recipientNameOrCred, credentialTitle, verifyUrl) {
    let email, name, title, url;
    if (typeof recipientEmailOrUser === 'object' && recipientEmailOrUser !== null) {
      email = recipientEmailOrUser.email;
      name = recipientEmailOrUser.name || recipientEmailOrUser.fullName || 'Recipient';
      const cred = recipientNameOrCred || {};
      title = cred.title || cred.credentialType || 'Workforce Credential';
      url = `${env.FRONTEND_URL}/verify/${cred.credentialId}`;
    } else {
      email = recipientEmailOrUser;
      name = recipientNameOrCred;
      title = credentialTitle;
      url = verifyUrl;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 8px;">
        <h2 style="color: #38bdf8;">SecureWork Verify — New Credential Issued</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>A new cryptographically verifiable credential has been issued to your portfolio:</p>
        <div style="background-color: #1e293b; padding: 16px; border-radius: 6px; border-left: 4px solid #06b6d4; margin: 16px 0;">
          <h3 style="margin: 0; color: #f8fafc;">${title}</h3>
        </div>
        <p>You can view and verify your credential certificate online:</p>
        <a href="${url}" style="background-color: #06b6d4; color: #000; padding: 10px 18px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Public Certificate</a>
      </div>
    `;
    return this.sendEmail({
      to: email,
      subject: `New Credential Issued: ${title}`,
      text: `Hello ${name}, a new credential (${title}) was issued to you. Verify at: ${url}`,
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
