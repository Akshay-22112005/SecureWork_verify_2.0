const authService = require('../services/auth.service');
const { successResponse } = require('../utils/response');
const { ValidationError } = require('../utils/errors');

/**
 * Handle user registration (POST /api/auth/register).
 * Public registration always assigns role USER.
 */
async function register(req, res, next) {
  try {
    const { name, email, password, invitationToken } = req.body;
    const result = await authService.register({ name, email, password, invitationToken });
    return successResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
}

async function getInvitationDetails(req, res, next) {
  try {
    const invitationToken = String(req.query.invite || req.query.token || '');
    if (!invitationToken) throw new ValidationError('Invitation token is required');
    const details = await authService.getOrganizationInviteDetails(invitationToken);
    return successResponse(res, details, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Handle user login (POST /api/auth/login).
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get currently authenticated user profile (GET /api/auth/me).
 */
async function getMe(req, res, next) {
  try {
    return successResponse(res, { user: req.user }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  getInvitationDetails,
  login,
  getMe
};
