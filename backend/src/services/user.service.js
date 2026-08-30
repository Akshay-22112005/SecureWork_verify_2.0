const User = require('../models/user.model');
const { ROLES, STATUSES } = require('../models/user.model');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

/**
 * User Service
 * Manages user profile retrieval, safe profile updates, and role assignments.
 */
class UserService {
  /**
   * Find a user by public userId or ObjectId.
   * @param {string} identifier
   * @returns {Promise<object>}
   */
  async findById(identifier) {
    let user = await User.findOne({ userId: identifier });
    if (!user && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(identifier);
    }

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return user.toJSON();
  }

  /**
   * Find a user by email address.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    return user ? user.toJSON() : null;
  }

  /**
   * Update a user's own profile.
   * SECURITY RULE: Users must NEVER be able to modify their own role, status, or userId.
   * Privileged fields are strictly filtered out.
   * @param {string} userId
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateProfile(userId, updateData) {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Only allow safe, non-privileged field updates
    if (typeof updateData.name === 'string' && updateData.name.trim().length > 0) {
      user.name = updateData.name.trim();
    }

    // Explicitly ignore / discard attempts to update role or status
    // (role and status cannot be escalated by the user)

    await user.save();
    return user.toJSON();
  }

  /**
   * Assign a new role to a user.
   * Can only be executed by an authorized ADMIN.
   * @param {string} targetUserId
   * @param {string} newRole
   * @param {object} actingAdmin
   * @returns {Promise<object>}
   */
  async assignRole(targetUserId, newRole, actingAdmin) {
    if (!actingAdmin || actingAdmin.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can assign user roles', 'FORBIDDEN');
    }

    if (!ROLES.includes(newRole)) {
      throw new ValidationError(`Invalid role "${newRole}". Allowed roles: ${ROLES.join(', ')}`);
    }

    let user = await User.findOne({ userId: targetUserId });
    if (!user && targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(targetUserId);
    }

    if (!user) {
      throw new NotFoundError('Target user not found', 'USER_NOT_FOUND');
    }

    user.role = newRole;
    await user.save();

    return user.toJSON();
  }

  /**
   * List users with optional filtering.
   * @param {object} [filters={}]
   * @param {string} [filters.role]
   * @param {string} [filters.status]
   * @param {number} [filters.page=1]
   * @param {number} [filters.limit=20]
   * @returns {Promise<{ users: object[], total: number, page: number, totalPages: number }>}
   */
  async listUsers(filters = {}) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.role && ROLES.includes(filters.role)) {
      query.role = filters.role;
    }
    if (filters.status && STATUSES.includes(filters.status)) {
      query.status = filters.status;
    }

    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(query)
    ]);

    return {
      users: users.map(u => u.toJSON()),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}

module.exports = new UserService();
