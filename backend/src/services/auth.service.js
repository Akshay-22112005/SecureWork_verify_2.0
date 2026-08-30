const User = require('../models/user.model');
const { generateToken, verifyToken } = require('../utils/jwt');
const { ValidationError, ConflictError, UnauthorizedError, NotFoundError } = require('../utils/errors');
const { isValidEmail } = require('../utils/validation');

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
   * @returns {Promise<{ user: object, token: string }>}
   */
  async register({ name, email, password }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    if (!email || !isValidEmail(email)) {
      throw new ValidationError('A valid email address is required');
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
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
