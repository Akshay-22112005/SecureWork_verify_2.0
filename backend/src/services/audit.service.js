const crypto = require('crypto');
const AuditLog = require('../models/auditLog.model');
const AuditCheckpoint = require('../models/auditCheckpoint.model');
const { sha256 } = require('../utils/crypto');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');

const GENESIS_STRING = 'GENESIS_SECUREWORK_VERIFY';
const GENESIS_HASH = sha256(GENESIS_STRING);

/**
 * Deterministically canonicalize objects for stable cryptographic hashing.
 * @param {*} obj
 * @returns {*}
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

/**
 * Compute SHA-256 hash for an audit log entry over all relevant canonical fields.
 * @param {object} entry
 * @returns {string}
 */
function computeAuditHash(entry) {
  const payload = {
    sequenceNumber: Number(entry.sequenceNumber),
    action: String(entry.action),
    performedBy: String(entry.performedBy),
    targetType: String(entry.targetType),
    targetId: String(entry.targetId),
    metadata: canonicalize(entry.metadata || {}),
    createdAt: new Date(entry.createdAt).toISOString(),
    previousHash: String(entry.previousHash)
  };
  return sha256(JSON.stringify(payload));
}

/**
 * Audit Service
 * Implements cryptographically verifiable, hash-chained audit logging and internal checkpoints.
 *
 * Invariant: Audit records are historical and append-only.
 * Note: MongoDB itself is not claimed to make them absolutely immutable;
 * the cryptographic hash chain provides tamper-evidence that detects any modification or deletion.
 */
class AuditService {
  constructor() {
    this.inMemoryEvents = [];
    this._appendLock = Promise.resolve();
  }

  getGenesisHash() {
    return GENESIS_HASH;
  }

  computeEntryHash(entry) {
    return computeAuditHash(entry);
  }

  /**
   * Append a new cryptographically chained audit log entry.
   * Concurrency serialized to maintain strict sequence number ordering and hash continuity.
   * @param {object} params
   * @returns {Promise<object>}
   */
  async appendLog({ action, performedBy, targetType, targetId, metadata = {}, createdAt = new Date() }) {
    if (!action || !performedBy || !targetType || !targetId) {
      throw new ValidationError('action, performedBy, targetType, and targetId are required for audit logging');
    }

    // Serialize append operations to eliminate sequence races
    const release = this._acquireLock();
    try {
      // 1. Fetch latest record in chain
      const lastRecord = await AuditLog.findOne().sort({ sequenceNumber: -1 });

      let sequenceNumber;
      let previousHash;

      if (!lastRecord) {
        // Genesis record
        sequenceNumber = 1;
        previousHash = GENESIS_HASH;
      } else {
        sequenceNumber = lastRecord.sequenceNumber + 1;
        previousHash = lastRecord.currentHash;
      }

      // 2. Build candidate entry
      const entryToHash = {
        sequenceNumber,
        action,
        performedBy,
        targetType,
        targetId,
        metadata,
        createdAt,
        previousHash
      };

      // 3. Compute deterministic hash over canonical payload
      const currentHash = computeAuditHash(entryToHash);

      // 4. Persist to MongoDB
      const record = await AuditLog.create({
        ...entryToHash,
        currentHash
      });

      return record.toJSON();
    } finally {
      release();
    }
  }

  /**
   * Backward-compatible event recording wrapper.
   * Automatically writes to hash-chained AuditLog and in-memory buffer.
   * @param {string} actorId
   * @param {string} actorRole
   * @param {string} action
   * @param {string} targetResource
   * @param {object} [metadata={}]
   */
  async recordEvent(actorId, actorRole, action, targetResource, metadata = {}) {
    // Derive targetType from targetResource prefix if possible
    let targetType = 'RESOURCE';
    if (targetResource) {
      if (targetResource.startsWith('org_')) targetType = 'ORGANIZATION';
      else if (targetResource.startsWith('iss_')) targetType = 'ISSUER';
      else if (targetResource.startsWith('key_')) targetType = 'ISSUER_KEY';
      else if (targetResource.startsWith('doc_')) targetType = 'DOCUMENT';
      else if (targetResource.startsWith('crd_')) targetType = 'CREDENTIAL';
      else if (targetResource.startsWith('vrf_')) targetType = 'VERIFICATION';
      else if (targetResource.startsWith('usr_')) targetType = 'USER';
      else if (targetResource.startsWith('src_') || targetResource.startsWith('SRC_')) targetType = 'TRUSTED_SOURCE';
      else if (targetResource.startsWith('ana_') || targetResource.startsWith('ai_')) targetType = 'ANALYSIS';
    }

    const performedBy = actorId || 'SYSTEM';
    const enrichedMetadata = {
      ...metadata,
      actorRole: actorRole || 'USER'
    };

    let chainedLog = null;
    try {
      chainedLog = await this.appendLog({
        action,
        performedBy,
        targetType,
        targetId: targetResource || 'GLOBAL',
        metadata: enrichedMetadata
      });
    } catch (err) {
      logger.error('Failed to append hash-chained audit log', { error: err.message });
    }

    const event = {
      eventId: chainedLog ? `aud_${chainedLog.currentHash.slice(0, 16)}` : `aud_${crypto.randomBytes(8).toString('hex')}`,
      sequenceNumber: chainedLog ? chainedLog.sequenceNumber : null,
      timestamp: new Date().toISOString(),
      actorId: performedBy,
      actorRole: actorRole || 'SYSTEM',
      action,
      targetResource,
      currentHash: chainedLog ? chainedLog.currentHash : null,
      previousHash: chainedLog ? chainedLog.previousHash : null,
      metadata: enrichedMetadata
    };

    logger.info(`[Audit] ${action} on ${targetResource} by ${performedBy} (${actorRole})`, {
      auditEvent: event
    });

    this.inMemoryEvents.push(event);
    return event;
  }

  /**
   * Validate entire audit log hash chain for tamper-evidence.
   * Rigorously detects:
   * - modified record
   * - deleted record (sequence gaps)
   * - reordered record
   * - broken previousHash
   * - incorrect currentHash
   * - invalid genesis hash
   * @returns {Promise<{
   *   valid: boolean,
   *   totalRecords: number,
   *   chainHeadHash: string|null,
   *   genesisHash: string,
   *   errors: Array<{ sequenceNumber: number, type: string, message: string }>
   * }>}
   */
  async validateChain() {
    const records = await AuditLog.find().sort({ sequenceNumber: 1 });
    const errors = [];

    if (!records || records.length === 0) {
      return {
        valid: true,
        totalRecords: 0,
        chainHeadHash: null,
        genesisHash: GENESIS_HASH,
        errors: []
      };
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const expectedSeq = i + 1;

      // 1. Check Sequence Number & Sequence Gaps / Deletions / Reordering
      if (record.sequenceNumber !== expectedSeq) {
        errors.push({
          sequenceNumber: record.sequenceNumber,
          type: 'SEQUENCE_GAP',
          message: `Sequence discrepancy at position ${i + 1}: expected sequenceNumber ${expectedSeq}, found ${record.sequenceNumber}. Indicates deleted or reordered records.`
        });
      }

      // 2. Check Previous Hash Linkage
      if (i === 0) {
        // Genesis record check
        if (record.previousHash !== GENESIS_HASH) {
          errors.push({
            sequenceNumber: record.sequenceNumber,
            type: 'INVALID_GENESIS',
            message: `Genesis record previousHash does not match SHA256("GENESIS_SECUREWORK_VERIFY"). Expected: ${GENESIS_HASH}, Found: ${record.previousHash}`
          });
        }
      } else {
        const prevRecord = records[i - 1];
        if (record.previousHash !== prevRecord.currentHash) {
          errors.push({
            sequenceNumber: record.sequenceNumber,
            type: 'BROKEN_PREVIOUS_HASH',
            message: `Record #${record.sequenceNumber} previousHash does not match record #${prevRecord.sequenceNumber} currentHash. Chain linkage is broken.`
          });
        }
      }

      // 3. Check Current Hash (Detects record modification / tampering)
      const expectedCurrentHash = computeAuditHash(record);
      if (record.currentHash !== expectedCurrentHash) {
        errors.push({
          sequenceNumber: record.sequenceNumber,
          type: 'INCORRECT_CURRENT_HASH',
          message: `Record #${record.sequenceNumber} currentHash mismatch. Computed hash (${expectedCurrentHash}) differs from stored hash (${record.currentHash}). Record content was modified.`
        });
      }
    }

    const chainHeadHash = records[records.length - 1].currentHash;

    return {
      valid: errors.length === 0,
      totalRecords: records.length,
      chainHeadHash,
      genesisHash: GENESIS_HASH,
      errors
    };
  }

  /**
   * Create an internal audit checkpoint anchoring current chain state.
   * Note: Local implementation is an internal checkpoint only;
   * does not claim external immutability.
   * @param {object} [params]
   * @param {object} [user]
   * @returns {Promise<object>}
   */
  async createCheckpoint({ externalAnchorType = 'INTERNAL_LOCAL', externalReference = null } = {}, user = null) {
    const lastRecord = await AuditLog.findOne().sort({ sequenceNumber: -1 });
    if (!lastRecord) {
      throw new ValidationError('Cannot create checkpoint on empty audit log', 'EMPTY_AUDIT_LOG');
    }

    const lastCheckpoint = await AuditCheckpoint.findOne().sort({ sequenceEnd: -1 });
    const sequenceStart = lastCheckpoint ? lastCheckpoint.sequenceEnd + 1 : 1;
    const sequenceEnd = lastRecord.sequenceNumber;

    if (sequenceStart > sequenceEnd) {
      throw new ValidationError(
        `No new audit records since checkpoint #${lastCheckpoint.checkpointId} (at sequence ${lastCheckpoint.sequenceEnd})`,
        'NO_NEW_RECORDS'
      );
    }

    const checkpoint = await AuditCheckpoint.create({
      sequenceStart,
      sequenceEnd,
      chainHeadHash: lastRecord.currentHash,
      externalAnchorType,
      externalReference: externalReference || `INTERNAL_ANCHOR_${Date.now()}`
    });

    logger.info(`[Audit] Checkpoint created: ${checkpoint.checkpointId} (Sequences ${sequenceStart}-${sequenceEnd})`, {
      checkpointId: checkpoint.checkpointId,
      chainHeadHash: checkpoint.chainHeadHash
    });

    return checkpoint.toJSON();
  }

  /**
   * List paginated audit logs.
   */
  async listLogs({ page = 1, limit = 50, action, performedBy, targetType, targetId } = {}) {
    const filter = {};
    if (action) filter.action = action;
    if (performedBy) filter.performedBy = performedBy;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ sequenceNumber: -1 }).skip(skip).limit(limitNum),
      AuditLog.countDocuments(filter)
    ]);

    const userIds = [...new Set(logs.map(l => l.performedBy).filter(id => typeof id === 'string' && id.startsWith('usr_')))];
    let userRoleMap = new Map();
    if (userIds.length > 0) {
      try {
        const User = require('../models/user.model');
        const users = await User.find({ userId: { $in: userIds } }, { userId: 1, role: 1 });
        userRoleMap = new Map(users.map(u => [u.userId, u.role]));
      } catch {}
    }

    const enrichedLogs = logs.map(l => {
      const logObj = l.toJSON();
      const roleFromMeta = logObj.metadata?.actorRole;
      const roleFromDb = userRoleMap.get(logObj.performedBy);
      let actorRole = roleFromMeta || roleFromDb;
      if (!actorRole) {
        if (logObj.performedBy === 'SYSTEM' || logObj.performedBy === 'system') {
          actorRole = 'SYSTEM';
        } else if (logObj.performedBy.startsWith('usr_')) {
          actorRole = 'USER';
        } else {
          actorRole = 'SYSTEM';
        }
      }
      return {
        ...logObj,
        actorId: logObj.performedBy,
        actorRole,
        targetResource: `${logObj.targetType}:${logObj.targetId}`
      };
    });

    return {
      logs: enrichedLogs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  /**
   * List checkpoints.
   */
  async listCheckpoints() {
    const checkpoints = await AuditCheckpoint.find().sort({ createdAt: -1 });
    return checkpoints.map(c => c.toJSON());
  }

  async getResourceAuditTrail(targetResource) {
    const logs = await AuditLog.find({ targetId: targetResource }).sort({ sequenceNumber: 1 });
    if (logs.length > 0) return logs.map(l => l.toJSON());
    return this.inMemoryEvents.filter(e => e.targetResource === targetResource);
  }

  clearEvents() {
    this.inMemoryEvents = [];
  }

  /**
   * Internal mutex lock for serializing audit log appends.
   * @private
   */
  _acquireLock() {
    let release;
    const nextLock = new Promise(resolve => {
      release = resolve;
    });
    const currentLock = this._appendLock;
    this._appendLock = currentLock.then(() => nextLock);
    return release;
  }
}

module.exports = new AuditService();
