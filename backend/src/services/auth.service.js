const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const { generateToken, verifyToken } = require('../utils/jwt');
const { ValidationError, ConflictError, UnauthorizedError, NotFoundError } = require('../utils/errors');
const { isValidEmail } = require('../utils/validation');

function readOrganizationInvite(invitationToken) {
  let claims;
  try {
    claims = verifyToken(invitationToken);
  } catch {
    throw new NotFoundError('Invitation token is invalid or has expired', 'INVITATION_INVALID');
  }
  if (claims.purpose !== 'ORGANIZATION_INVITE' || claims.role !== 'HR' || !claims.email || !claims.organizationId) {
    throw new NotFoundError('Invitation token is invalid or has expired', 'INVITATION_INVALID');
  }
  return claims;
}

/**
 * Authentication Service
 * Manages user registration, credential authentication, password hashing, and token issuing.
 */
class AuthService {
  /**
   * Register a new user via public registration.
   * SECURITY RULE: Public registration MUST ALWAYS assign role "USER".
   * Clients can NEVER specify privileged roles (ADMIN, ISSUER, HR, AUDITOR).
   * @param {object} params
   * @param {string} params.name
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} [params.invitationToken]
   * @returns {Promise<{ user: object, token: string }>}
   */
  async register({ name, email, password, invitationToken }) {
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (invitationToken) {
      if (String(invitationToken).split('.').length === 3) {
        const claims = readOrganizationInvite(invitationToken);
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!isValidEmail(normalizedEmail) || normalizedEmail !== String(claims.email).toLowerCase()) {
          throw new ValidationError('Registration email does not match the invitation');
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          throw new ValidationError('Name is required');
        }
        if (await User.findOne({ email: normalizedEmail })) {
          throw new ConflictError('Email is already registered', 'DUPLICATE_EMAIL');
        }
        const organization = await Organization.findById(claims.organizationId);
        if (!organization) throw new NotFoundError('Invited organization no longer exists', 'ORGANIZATION_NOT_FOUND');
        const passwordHash = await User.hashPassword(password);
        const user = await User.create({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          status: 'ACTIVE',
          role: 'HR',
          organizationId: organization._id
        });
        return { user: user.toJSON(), token: generateToken(user) };
      }

      const passwordHash = await User.hashPassword(password);
      const pendingInvite = await User.findOne({
        invitationToken,
        status: 'PENDING_INVITE',
        invitationExpiresAt: { $gt: new Date() }
      }).select('role');
      if (!pendingInvite) {
        throw new NotFoundError('Invitation token is invalid or has expired', 'INVITATION_INVALID');
      }
      // MEMBER is an organization label; the standard candidate permissions use USER.
      const invitedRole = pendingInvite.role === 'MEMBER' ? 'USER' : pendingInvite.role;
      const user = await User.findOneAndUpdate(
        {
          invitationToken,
          status: 'PENDING_INVITE',
          invitationExpiresAt: { $gt: new Date() }
        },
        {
          $set: { passwordHash, status: 'ACTIVE', role: invitedRole, invitationToken: null, invitationExpiresAt: null }
        },
        { new: true, runValidators: true }
      );
      if (!user) {
        throw new NotFoundError('Invitation token is invalid or has expired', 'INVITATION_INVALID');
      }

      const token = generateToken(user);
      return { user: user.toJSON(), token };
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    if (!email || !isValidEmail(email)) {
      throw new ValidationError('A valid email address is required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ConflictError('Email is already registered', 'DUPLICATE_EMAIL');
    }

    // Hash password securely with bcrypt
    const passwordHash = await User.hashPassword(password);

    // Create user strictly enforcing role "USER" and status "ACTIVE"
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'USER', // Enforce default unprivileged role
      status: 'ACTIVE'
    });

    // Generate minimal claims JWT
    const token = generateToken(user);

    return {
      user: user.toJSON(),
      token
    };
  }

  /**
   * Authenticate user credentials and return JWT token.
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {Promise<{ user: object, token: string }>}
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user and select hidden passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      // Use uniform message to prevent account enumeration
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active. Please contact support.', 'ACCOUNT_INACTIVE');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Normalize legacy/organization MEMBER accounts to the baseline system role.
    if (user.role === 'MEMBER') {
      user.role = 'USER';
      await user.save();
    }

    const token = generateToken(user);

    return {
      user: user.toJSON(),
      token
    };
  }

  /**
   * Validate and decode an existing token.
   * @param {string} token
   * @returns {object}
   */
  verifyToken(token) {
    return verifyToken(token);
  }

  async getOrganizationInviteDetails(invitationToken) {
    const claims = readOrganizationInvite(invitationToken);
    const organization = await Organization.findById(claims.organizationId).select('name organizationId');
    if (!organization) throw new NotFoundError('Invited organization no longer exists', 'ORGANIZATION_NOT_FOUND');
    return {
      email: claims.email,
      role: claims.role,
      organizationId: organization.organizationId,
      organizationName: organization.name
    };
  }

  /**
   * Retrieve current user profile by userId.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getCurrentUser(userId) {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User profile not found', 'USER_NOT_FOUND');
    }

    return user.toJSON();
  }
}

module.exports = new AuthService();
