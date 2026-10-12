const mongoose = require('mongoose');
const VerificationEvidence = require('../models/verificationEvidence.model');
const auditService = require('../services/audit.service');
const { successResponse } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

async function approveEvidence(req, res, next) {
  try {
    const identifierQueries = [{ evidenceId: req.params.id }];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      identifierQueries.push({ _id: req.params.id });
    }
    const evidence = await VerificationEvidence.findOne({ $or: identifierQueries });

    if (!evidence) throw new NotFoundError('Evidence record not found');

    if (evidence.evidenceStatus !== 'VERIFIED' || evidence.status !== 'VERIFIED') {
      evidence.status = 'VERIFIED';
      evidence.evidenceStatus = 'VERIFIED';
      await evidence.save();

      await auditService.appendLog({
        action: 'EVIDENCE_MANUALLY_APPROVED',
        performedBy: req.user.userId,
        targetType: 'VERIFICATION_EVIDENCE',
        targetId: evidence.evidenceId,
        metadata: {
          verificationId: evidence.verificationId,
          evidenceType: evidence.evidenceType,
          actorRole: req.user.role
        }
      });
    }

    return successResponse(res, { evidence }, 200);
  } catch (err) {
    return next(err);
  }
}

module.exports = { approveEvidence };
