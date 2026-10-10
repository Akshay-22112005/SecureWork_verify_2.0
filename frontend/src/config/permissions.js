/**
 * SecureWork Verify - Single Source of Truth for Role-Based Access Control (RBAC)
 * Defines role permissions, allowed routes, action capabilities, and default home pages.
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  ISSUER: 'ISSUER',
  AUDITOR: 'AUDITOR',
  HR: 'HR',
  USER: 'USER'
};

export const ROLE_HOME_PAGES = {
  ADMIN: '/admin/users',
  ISSUER: '/issuer/status',
  AUDITOR: '/audit/logs',
  HR: '/trusted-sources/verify',
  USER: '/dashboard'
};

export const ROUTE_PERMISSIONS = {
  '/dashboard': ['ADMIN', 'USER', 'ISSUER', 'HR', 'AUDITOR'],
  '/upload': ['ADMIN', 'USER'],
  '/credentials': ['ADMIN', 'USER'],
  '/history': ['ADMIN', 'USER', 'HR'],
  '/analysis': ['ADMIN', 'USER'],
  '/verify': ['ADMIN', 'HR', 'USER'],
  '/credentials/issue': ['ADMIN', 'ISSUER'],
  '/credentials/all': ['ADMIN', 'ISSUER'],
  '/issuer/status': ['ADMIN', 'ISSUER'],
  '/keys': ['ADMIN', 'ISSUER'],
  '/trusted-sources/verify': ['ADMIN', 'HR'],
  '/audit/logs': ['ADMIN', 'AUDITOR'],
  '/audit/evidence': ['ADMIN', 'AUDITOR'],
  '/audit/chain': ['ADMIN', 'AUDITOR'],
  '/admin/users': ['ADMIN'],
  '/admin/organizations': ['ADMIN'],
  '/admin/trusted-sources': ['ADMIN'],
  '/admin/issuers': ['ADMIN'],
  '/admin/settings': ['ADMIN']
};

export const CAPABILITIES = {
  // Credential issuance and management
  ISSUE_CREDENTIALS: ['ADMIN', 'ISSUER'],
  MANAGE_KEYS: ['ADMIN', 'ISSUER'],
  VIEW_ALL_CREDENTIALS: ['ADMIN', 'ISSUER'],
  REVOKE_CREDENTIAL: ['ADMIN', 'ISSUER'],
  
  // Document uploading & personal credential viewing
  UPLOAD_DOCUMENT: ['ADMIN', 'USER'],
  VIEW_OWN_CREDENTIALS: ['ADMIN', 'USER'],
  RUN_DOCUMENT_ANALYSIS: ['ADMIN', 'USER'],
  
  // HR verification capabilities
  VERIFY_CANDIDATE: ['ADMIN', 'HR'],
  VERIFY_OFFICIAL_SOURCE: ['ADMIN', 'HR'],
  VIEW_VERIFICATION_HISTORY: ['ADMIN', 'HR', 'USER'],
  
  // Auditor compliance capabilities (strictly read-only / validation)
  VIEW_AUDIT_LOGS: ['ADMIN', 'AUDITOR'],
  VIEW_VERIFICATION_EVIDENCE: ['ADMIN', 'AUDITOR'],
  VALIDATE_AUDIT_CHAIN: ['ADMIN', 'AUDITOR'],
  
  // Admin governance capabilities
  MANAGE_USERS: ['ADMIN'],
  ASSIGN_ROLES: ['ADMIN'],
  MANAGE_ORGANIZATIONS: ['ADMIN'],
  MANAGE_TRUSTED_SOURCES: ['ADMIN'],
  APPROVE_ISSUERS: ['ADMIN'],
  VIEW_SYSTEM_SETTINGS: ['ADMIN']
};

/**
 * Check whether a user role has permission to access a specific route.
 * @param {string} role - User role
 * @param {string} path - Target path
 * @returns {boolean}
 */
export function hasRouteAccess(role, path) {
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  
  // Find matching route pattern
  const normalizedPath = path.replace(/\/$/, '') || '/';
  const allowedRoles = ROUTE_PERMISSIONS[normalizedPath];
  
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Check whether a user role has a specific capability/permission.
 * @param {string} role - User role
 * @param {string} capability - Key from CAPABILITIES
 * @returns {boolean}
 */
export function canPerform(role, capability) {
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  
  const allowed = CAPABILITIES[capability];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Get default landing dashboard for a given role.
 * @param {string} role - User role
 * @returns {string}
 */
export function getDefaultDashboard(role) {
  return ROLE_HOME_PAGES[role] || '/dashboard';
}
