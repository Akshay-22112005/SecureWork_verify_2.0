const userService = require('../services/user.service');
const { successResponse } = require('../utils/response');
const { ForbiddenError } = require('../utils/errors');

/**
 * Get profile of currently authenticated user (GET /api/users/me).
 */
async function getMe(req, res, next) {
  try {
    return successResponse(res, { user: req.user }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Update profile of currently authenticated user (PATCH /api/users/me).
 * SECURITY RULE: Users can only update non-privileged fields (name).
 * Role and status changes are strictly ignored/prevented.
 */
async function updateMe(req, res, next) {
  try {
    const updatedUser = await userService.updateProfile(req.user.userId, req.body);
    return successResponse(res, { user: updatedUser }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get user by identifier (GET /api/users/:id).
 * Access rule: Self or ADMIN or AUDITOR.
 */
async function getUserById(req, res, next) {
  try {
    const targetId = req.params.id;
    const isSelf = req.user.userId === targetId || req.user.id === targetId;
    const isPrivileged = req.user.role === 'ADMIN' || req.user.role === 'AUDITOR';

    if (!isSelf && !isPrivileged) {
      throw new ForbiddenError('Access denied: You can only view your own user profile', 'FORBIDDEN');
    }

    const user = await userService.findById(targetId);
    return successResponse(res, { user }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Assign user role (PATCH /api/users/:id/role).
 * Restricted to ADMIN role only.
 */
async function updateUserRole(req, res, next) {
  try {
    const targetId = req.params.id;
    const { role } = req.body;
    const updatedUser = await userService.assignRole(targetId, role, req.user);
    return successResponse(res, { user: updatedUser }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * List users (GET /api/users).
 * Restricted to ADMIN and AUDITOR roles.
 */
async function listUsers(req, res, next) {
  try {
    const result = await userService.listUsers(req.query);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateMe,
  getUserById,
  updateUserRole,
  listUsers
};
