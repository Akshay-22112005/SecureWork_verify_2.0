/**
 * Frontend API client service
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Health check HTTP status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: {
        message: err.message
      }
    };
  }
}

export default {
  fetchHealth
};
