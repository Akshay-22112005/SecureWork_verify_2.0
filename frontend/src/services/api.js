import { apiClient } from './client';

export const api = {
  // Health
  health: {
    check: () => apiClient('/health')
  },

  // Auth
  auth: {
    login: (credentials) => apiClient('/auth/login', { method: 'POST', body: credentials }),
    register: (userData) => apiClient('/auth/register', { method: 'POST', body: userData }),
    getMe: () => apiClient('/auth/me')
  },

  // Users
  users: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/users${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/users/${id}`),
    updateRole: (id, role) => apiClient(`/users/${id}/role`, { method: 'PATCH', body: { role } })
  },

  // Documents
  documents: {
    upload: (formData) => apiClient('/documents/upload', { method: 'POST', body: formData }),
    getById: (id) => apiClient(`/documents/${id}`),
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/documents${q ? `?${q}` : ''}`);
    }
  },

  // OCR & AI Analysis
  analysis: {
    runOcr: (documentId) => apiClient('/analysis/ocr', { method: 'POST', body: { documentId } }),
    runAi: (documentId) => apiClient('/analysis/document', { method: 'POST', body: { documentId } }),
    getByDocumentId: (documentId) => apiClient(`/analysis/${documentId}`)
  },

  // Credentials
  credentials: {
    issue: (data) => apiClient('/credentials/issue', { method: 'POST', body: data }),
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/credentials${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/credentials/${id}`),
    getVersions: (id) => apiClient(`/credentials/${id}/versions`),
    getTimeline: (id) => apiClient(`/credentials/${id}/timeline`),
    createVersion: (id, data) => apiClient(`/credentials/${id}/versions`, { method: 'POST', body: data }),
    revoke: (id, reason) => apiClient(`/credentials/${id}/revoke`, { method: 'PATCH', body: { reason } })
  },

  // Verification Engine & Evidence
  verifications: {
    evaluate: (input) => apiClient('/verifications/evaluate', { method: 'POST', body: input }),
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/verifications${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/verifications/${id}`),
    getByCredential: (credentialId) => apiClient(`/verifications/credential/${credentialId}`),
    getEvidence: (id) => apiClient(`/verifications/${id}/evidence`),
    verifySource: (data) => apiClient('/verifications/verify-source', { method: 'POST', body: data }),
    submitManualReview: (id, data) => apiClient(`/verifications/${id}/manual-review`, { method: 'POST', body: data })
  },

  // Organizations
  organizations: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/organizations${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/organizations/${id}`),
    create: (data) => apiClient('/organizations', { method: 'POST', body: data }),
    verify: (id, data = {}) => apiClient(`/organizations/${id}/verify`, { method: 'PATCH', body: data }),
    suspend: (id, reason) => apiClient(`/organizations/${id}/suspend`, { method: 'PATCH', body: { reason } }),
    revoke: (id, reason) => apiClient(`/organizations/${id}/revoke`, { method: 'PATCH', body: { reason } })
  },

  // Issuers
  issuers: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/issuers${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/issuers/${id}`),
    register: (data) => apiClient('/issuers', { method: 'POST', body: data }),
    approve: (id) => apiClient(`/issuers/${id}/approve`, { method: 'PATCH' }),
    suspend: (id, reason) => apiClient(`/issuers/${id}/suspend`, { method: 'PATCH', body: { reason } }),
    revoke: (id, reason) => apiClient(`/issuers/${id}/revoke`, { method: 'PATCH', body: { reason } })
  },

  // Issuer Keys
  issuerKeys: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/issuer-keys${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/issuer-keys/${id}`),
    rotate: (issuerId) => apiClient('/issuer-keys/rotate', { method: 'POST', body: { issuerId } }),
    compromise: (keyId, reason) => apiClient(`/issuer-keys/${keyId}/compromise`, { method: 'PATCH', body: { reason } })
  },

  // Trusted Sources
  trustedSources: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/trusted-sources${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/trusted-sources/${id}`),
    register: (data) => apiClient('/trusted-sources', { method: 'POST', body: data }),
    approve: (id) => apiClient(`/trusted-sources/${id}/approve`, { method: 'PATCH' }),
    suspend: (id, reason) => apiClient(`/trusted-sources/${id}/suspend`, { method: 'PATCH', body: { reason } }),
    revoke: (id, reason) => apiClient(`/trusted-sources/${id}/revoke`, { method: 'PATCH', body: { reason } })
  },

  // Audit Logs & Hash Chain
  auditLogs: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/audit-logs${q ? `?${q}` : ''}`);
    },
    validateChain: () => apiClient('/audit-logs/validate'),
    createCheckpoint: (data = { externalAnchorType: 'INTERNAL_LOCAL' }) => apiClient('/audit-logs/checkpoint', { method: 'POST', body: data }),
    listCheckpoints: () => apiClient('/audit-logs/checkpoints')
  },

  // In-App Notifications
  notifications: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/notifications${q ? `?${q}` : ''}`);
    },
    markAsRead: (id) => apiClient(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllAsRead: () => apiClient('/notifications/read-all', { method: 'PATCH' })
  }
};

export const fetchHealth = api.health.check;
export default api;
