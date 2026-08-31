/**
 * Centralized API HTTP client
 * Enforces standardized request headers, JWT authentication injection,
 * automatic 401 session expiration handling, and JSON/multipart handling.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onSessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  onSessionExpiredHandler = handler;
}

export async function apiClient(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const token = localStorage.getItem('securework_token');
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle FormData vs JSON
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body
  });

  // Check 401 Unauthorized / Token Expiry
  if (response.status === 401) {
    localStorage.removeItem('securework_token');
    localStorage.removeItem('securework_user');
    if (typeof onSessionExpiredHandler === 'function') {
      onSessionExpiredHandler();
    }
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorInfo = data?.error || {};
    const message = errorInfo.message || data?.message || `HTTP ${response.status}: Request failed`;
    const code = errorInfo.code || data?.code || 'API_ERROR';
    throw new ApiError(message, response.status, code, errorInfo);
  }

  return data;
}

export default apiClient;
