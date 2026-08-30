const crypto = require('crypto');
const IssuerKey = require('../models/issuerKey.model');
const Issuer = require('../models/issuer.model');
const { keyStorage, generateEd25519KeyPair, signEd25519, verifyEd25519 } = require('./crypto');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Issuer Key Management Service
 * Manages cryptographic keypairs, secure rotation, compromise handling, and digital signing.
 */
class IssuerKeyService {
  /**
   * Helper to verify actor can manage an issuer's keys (ADMIN or owner of issuer profile).
   */
  async checkAuthorization(issuerId, actorUser) {
    if (!actorUser) {
      throw new ForbiddenError('Authenticated user required', 'UNAUTHORIZED');
    }
    if (actorUser.role === 'ADMIN') {
      return true;
    }
    const issuer = await Issuer.findOne({
      $or: [{ issuerId }, { issuerCode: issuerId }]
    });
    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }
    if (issuer.userId !== actorUser.userId) {
      throw new ForbiddenError('You do not have permission to manage keys for this issuer', 'FORBIDDEN');
    }
    return true;
  }

  /**
   * Generate an Ed25519 keypair for an issuer.
   * Private key is stored strictly in keyStorage (never in MongoDB).
   * @param {string} issuerId
   * @param {object} actorUser
   * @returns {Promise<object>} Created IssuerKey document (public metadata only)
   */
  async generateKeyForIssuer(issuerId, actorUser) {
    await this.checkAuthorization(issuerId, actorUser);

    const issuer = await Issuer.findOne({
      $or: [{ issuerId }, { issuerCode: issuerId }]
    });
    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    if (issuer.status !== 'ACTIVE') {
      throw new ValidationError(
        `Cannot generate key for issuer with status "${issuer.status}". Issuer must be ACTIVE.`,
        'ISSUER_NOT_ACTIVE'
      );
    }

    // 1. Generate Ed25519 keypair
    const { publicKeyPem, privateKeyPem } = generateEd25519KeyPair();
    const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;

    // 2. Securely store private key via KeyStorage adapter
    const privateKeyRef = await keyStorage.storePrivateKey(keyId, privateKeyPem);

    // 3. Save public key and metadata in MongoDB (private key is omitted)
    const issuerKey = await IssuerKey.create({
      issuerId: issuer.issuerId,
      keyId,
      algorithm: 'ED25519',
      publicKey: publicKeyPem,
      privateKeyReference: privateKeyRef,
      status: 'ACTIVE',
      activatedAt: new Date()
    });

    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'ISSUER_KEY_GENERATED',
      keyId,
      {
        issuerId: issuer.issuerId,
        algorithm: 'ED25519',
        keyId
      }
    );

    return issuerKey.toJSON();
  }

  /**
   * Rotate issuer key.
   * Retires active key(s) without deleting them, and generates a new active key.
   * Historical credentials retain their historical issuerKeyId.
   * @param {string} issuerId
   * @param {object} actorUser
   * @returns {Promise<object>} Newly generated active IssuerKey
   */
  async rotateIssuerKey(issuerId, actorUser) {
    await this.checkAuthorization(issuerId, actorUser);

    const issuer = await Issuer.findOne({
      $or: [{ issuerId }, { issuerCode: issuerId }]
    });
    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    if (issuer.status !== 'ACTIVE') {
      throw new ValidationError(
        `Cannot rotate key for issuer with status "${issuer.status}". Issuer must be ACTIVE.`,
        'ISSUER_NOT_ACTIVE'
      );
    }

    // Retire all currently active keys for this issuer
    const now = new Date();
    await IssuerKey.updateMany(
      { issuerId: issuer.issuerId, status: 'ACTIVE' },
      {
        status: 'RETIRED',
        retiredAt: now,
        statusReason: 'Rotated to new active key'
      }
    );

    // Generate new active key
    const newKey = await this.generateKeyForIssuer(issuer.issuerId, actorUser);

    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'ISSUER_KEY_ROTATED',
      newKey.keyId,
      {
        issuerId: issuer.issuerId,
        newKeyId: newKey.keyId,
        rotatedAt: now.toISOString()
      }
    );

    await notificationService.notifyUser({
      recipientUserId: issuer.userId,
      type: 'KEY_ROTATED',
      title: 'Issuer Key Rotated',
      message: `Active key rotated for issuer ${issuer.name}. New key: ${newKey.keyId}`,
      severity: 'INFO',
      data: { issuerId: issuer.issuerId, newKeyId: newKey.keyId }
    });

    return newKey;
  }

  /**
   * Flag an issuer key as COMPROMISED.
   * Stops new signing, records compromise timestamp, while preserving public key for audit.
   * @param {string} keyId
   * @param {object} options
   * @param {object} actorUser
   * @returns {Promise<object>}
   */
  async compromiseKey(keyId, options = {}, actorUser) {
    const key = await IssuerKey.findOne({ keyId });
    if (!key) {
      throw new NotFoundError('Issuer key not found', 'KEY_NOT_FOUND');
    }

    await this.checkAuthorization(key.issuerId, actorUser);

    key.status = 'COMPROMISED';
    key.compromisedAt = new Date();
    key.statusReason = options.reason || 'Key reported as compromised';
    await key.save();

    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'ISSUER_KEY_COMPROMISED',
      keyId,
      {
        issuerId: key.issuerId,
        reason: key.statusReason,
        compromisedAt: key.compromisedAt.toISOString()
      }
    );

    // Notify issuer and admins
    const issuer = await Issuer.findOne({ issuerId: key.issuerId });
    if (issuer && issuer.userId) {
      await notificationService.notifyUser({
        recipientUserId: issuer.userId,
        type: 'KEY_COMPROMISED',
        title: 'CRITICAL: Issuer Key Compromised',
        message: `Key ${keyId} for issuer ${key.issuerId} was flagged as COMPROMISED. Reason: ${key.statusReason}`,
        severity: 'CRITICAL',
        data: { keyId, issuerId: key.issuerId }
      });
    }
    await notificationService.notifyRole('ADMIN', {
      type: 'SECURITY_ALERT',
      title: 'SECURITY ALERT: Key Compromised',
      message: `Key ${keyId} flagged as COMPROMISED. Reason: ${key.statusReason}`,
      severity: 'CRITICAL',
      data: { keyId, issuerId: key.issuerId }
    });

    return key.toJSON();
  }

  /**
   * Flag an issuer key as REVOKED.
   * @param {string} keyId
   * @param {object} options
   * @param {object} actorUser
   * @returns {Promise<object>}
   */
  async revokeKey(keyId, options = {}, actorUser) {
    const key = await IssuerKey.findOne({ keyId });
    if (!key) {
      throw new NotFoundError('Issuer key not found', 'KEY_NOT_FOUND');
    }

    await this.checkAuthorization(key.issuerId, actorUser);

    key.status = 'REVOKED';
    key.revokedAt = new Date();
    key.statusReason = options.reason || 'Key permanently revoked';
    await key.save();

    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'ISSUER_KEY_REVOKED',
      keyId,
      {
        issuerId: key.issuerId,
        reason: key.statusReason,
        revokedAt: key.revokedAt.toISOString()
      }
    );

    return key.toJSON();
  }

  /**
   * Get active key for an issuer.
   * @param {string} issuerId
   * @returns {Promise<object>}
   */
  async getActiveKeyForIssuer(issuerId) {
    const key = await IssuerKey.findOne({
      issuerId,
      status: 'ACTIVE'
    });

    if (!key) {
      throw new NotFoundError(`No active cryptographic key found for issuer "${issuerId}"`, 'NO_ACTIVE_KEY');
    }

    return key.toJSON();
  }

  /**
   * Retrieve key metadata by keyId (public key only).
   * @param {string} keyId
   * @returns {Promise<object>}
   */
  async getKeyById(keyId) {
    const key = await IssuerKey.findOne({
      $or: [{ keyId }, { _id: keyId.match(/^[0-9a-fA-F]{24}$/) ? keyId : null }]
    });

    if (!key) {
      throw new NotFoundError('Issuer key not found', 'KEY_NOT_FOUND');
    }

    return key.toJSON();
  }

  /**
   * List issuer keys with optional filtering and pagination.
   * @param {object} [filters={}]
   * @returns {Promise<{ keys: object[], total: number, page: number, totalPages: number }>}
   */
  async listKeys(filters = {}) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.issuerId) query.issuerId = filters.issuerId;
    if (filters.status) query.status = filters.status;

    const [keys, total] = await Promise.all([
      IssuerKey.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      IssuerKey.countDocuments(query)
    ]);

    return {
      keys: keys.map(k => k.toJSON()),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Sign payload using an issuer's active key.
   * Used by credential issuance workflows.
   * @param {string} keyId
   * @param {string | Buffer | object} payload
   * @returns {Promise<{ signature: string, algorithm: string, keyId: string }>}
   */
  async signPayload(keyId, payload) {
    const key = await IssuerKey.findOne({ keyId }).select('+privateKeyReference');
    if (!key) {
      throw new NotFoundError('Issuer key not found', 'KEY_NOT_FOUND');
    }

    if (key.status !== 'ACTIVE') {
      throw new ValidationError(
        `Cannot sign with key "${keyId}" because its status is ${key.status}. Key must be ACTIVE.`,
        'KEY_NOT_ACTIVE'
      );
    }

    const privateKeyPem = await keyStorage.getPrivateKey(key.keyId);
    const signature = signEd25519(payload, privateKeyPem, 'hex');

    return {
      signature,
      algorithm: key.algorithm,
      keyId: key.keyId
    };
  }

  /**
   * Verify payload signature against an issuer key.
   * Works for ACTIVE and RETIRED keys (for historical credentials), but rejects invalid signatures.
   * @param {string} keyId
   * @param {string | Buffer | object} payload
   * @param {string} signature
   * @returns {Promise<{ isValid: boolean, keyStatus: string, keyId: string }>}
   */
  async verifyPayload(keyId, payload, signature) {
    const key = await IssuerKey.findOne({ keyId });
    if (!key) {
      throw new NotFoundError('Issuer key not found', 'KEY_NOT_FOUND');
    }

    const isValid = verifyEd25519(payload, signature, key.publicKey, 'hex');

    return {
      isValid,
      keyStatus: key.status,
      keyId: key.keyId
    };
  }
}

module.exports = new IssuerKeyService();
