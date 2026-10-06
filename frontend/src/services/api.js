import { apiClient, API_BASE } from './client';

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
    getMe: () => apiClient('/users/me'),
    updateMe: (data) => apiClient('/users/me', { method: 'PATCH', body: data }),
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
    verify: (id, data = {}) => apiClient(`/organizations/${id}/verify`, { method: 'POST', body: data }),
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
    register: (data) => apiClient('/issuers/register', { method: 'POST', body: data }),
    approve: (id) => apiClient(`/issuers/${id}/approve`, { method: 'PATCH' }),
    suspend: (id, reason) => apiClient(`/issuers/${id}/suspend`, { method: 'PATCH', body: { reason } }),
    revoke: (id, reason) => apiClient(`/issuers/${id}/revoke`, { method: 'PATCH', body: { reason } }),
    rotateKey: (id, data = {}) => apiClient(`/issuers/${id}/rotate-key`, { method: 'POST', body: data })
  },

  // Issuer Keys
  issuerKeys: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/issuer-keys${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/issuer-keys/${id}`),
    rotate: (issuerId, data = {}) => apiClient(`/issuers/${issuerId}/rotate-key`, { method: 'POST', body: data }),
    compromise: (keyId, reason) => apiClient(`/issuer-keys/${keyId}/compromise`, { method: 'PATCH', body: { reason } }),
    revoke: (keyId, reason) => apiClient(`/issuer-keys/${keyId}/revoke`, { method: 'PATCH', body: { reason } })
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
    revoke: (id, reason) => apiClient(`/trusted-sources/${id}/revoke`, { method: 'PATCH', body: { reason } }),
    verifyDomain: (id) => apiClient(`/trusted-sources/${id}/verify-domain`, { method: 'POST' })
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

  // Public Verification (No Login Required)
  public: {
    verify: (id) => apiClient(`/public/verify/${id}`, { skipAuth: true }),
    getPdfUrl: (id) => `${API_BASE}/public/pdf/${id}`,
    getBundleUrl: (id) => `${API_BASE}/public/bundle/${id}`,
    getW3cUrl: (id) => `${API_BASE}/public/w3c/${id}`,
    getQrUrl: (id) => `${API_BASE}/public/qr/${id}`,
    listRevocations: () => apiClient('/public/revocations', { skipAuth: true })
  },

  // In-App Notifications
  notifications: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/notifications${q ? `?${q}` : ''}`);
    },
    markAsRead: (id) => apiClient(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllAsRead: () => apiClient('/notifications/read-all', { method: 'PATCH' })
  },

  // API Keys (B2B Employer Integrations)
  apiKeys: {
    list: () => apiClient('/api-keys'),
    create: (data) => apiClient('/api-keys', { method: 'POST', body: data }),
    revoke: (id) => apiClient(`/api-keys/${id}`, { method: 'DELETE' })
  },

  // Webhooks
  webhooks: {
    list: () => apiClient('/webhooks'),
    register: (data) => apiClient('/webhooks', { method: 'POST', body: data }),
    delete: (id) => apiClient(`/webhooks/${id}`, { method: 'DELETE' })
  },

  // Analytics
  analytics: {
    getOverview: () => apiClient('/analytics/overview')
  },

  // Credentials (Enhanced with Bulk Issue & Tamper Test)
  credentials: {
    issue: (data) => apiClient('/credentials/issue', { method: 'POST', body: data }),
    bulkIssue: (data) => apiClient('/credentials/bulk-issue', { method: 'POST', body: data }),
    simulateTamper: (id, tamperType) => apiClient(`/credentials/${id}/simulate-tamper`, { method: 'POST', body: { tamperType } }),
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiClient(`/credentials${q ? `?${q}` : ''}`);
    },
    getById: (id) => apiClient(`/credentials/${id}`),
    getVersions: (id) => apiClient(`/credentials/${id}/versions`),
    getTimeline: (id) => apiClient(`/credentials/${id}/timeline`),
    createVersion: (id, data) => apiClient(`/credentials/${id}/versions`, { method: 'POST', body: data }),
    revoke: (id, reason) => apiClient(`/credentials/${id}/revoke`, { method: 'PATCH', body: { reason } })
  }
};

export const fetchHealth = api.health.check;
export default api;
