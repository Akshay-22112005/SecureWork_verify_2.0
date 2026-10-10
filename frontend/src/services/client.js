/**
 * Centralized API HTTP client
 * Enforces standardized request headers, JWT authentication injection,
 * automatic 401 session expiration handling, and JSON/multipart handling.
 */

// Normalize base API URL from environment (supports VITE_API_URL or VITE_API_BASE_URL or dev proxy /api)
function resolveApiBaseUrl() {
  const envBase = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '');
  // If base is only a host e.g. "http://localhost:5000", append "/api"
  if (/^https?:\/\/[^/]+$/.test(envBase)) {
    return `${envBase}/api`;
  }
  return envBase;
}

export const API_BASE = resolveApiBaseUrl();

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
  const base = resolveApiBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${base}/${endpoint.replace(/^\/+/, '')}`;
  
  // Check sessionStorage first (non-persistent), then localStorage (remember-me persistent)
  const token = (() => {
    const s = sessionStorage.getItem('securework_token');
    if (s && s !== 'null' && s !== 'undefined') return s;
    const l = localStorage.getItem('securework_token');
    if (l && l !== 'null' && l !== 'undefined') return l;
    return null;
  })();
  const headers = { ...options.headers };

  // Automatically attach JWT authorization header where available unless explicitly skipped
  if (!options.skipAuth && token && !headers['Authorization']) {
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

  // Check 401 Unauthorized / Token Expiry (excluding login/register attempts)
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
    localStorage.removeItem('securework_token');
    localStorage.removeItem('securework_user');
    sessionStorage.removeItem('securework_token');
    sessionStorage.removeItem('securework_user');
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
    const errorInfo = (typeof data === 'object' && data !== null) ? (data.error || {}) : {};
    const message = (typeof errorInfo === 'string' ? errorInfo : errorInfo.message) || data?.message || `HTTP ${response.status}: Request failed`;
    const code = errorInfo.code || data?.code || 'API_ERROR';
    throw new ApiError(message, response.status, code, errorInfo);
  }

  return data;
}

export default apiClient;
