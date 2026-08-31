import React from 'react';

export default function StatusBadge({ status, label, className = '' }) {
  const norm = String(status || label || '').toUpperCase();

  let type = 'neutral';
  if (['ACTIVE', 'VERIFIED', 'PASSED', 'LEVEL 5 CURRENTLY_VALID', 'CONFIRMED', 'SUCCESS', 'ONLINE', 'HEALTHY'].includes(norm)) {
    type = 'healthy';
  } else if (['PENDING', 'MANUAL_REVIEW', 'SOURCE_FOUND', 'LEVEL 1 SOURCE_FOUND', 'LEVEL 2 SOURCE_VERIFIED', 'WARNING', 'UNAVAILABLE'].includes(norm)) {
    type = 'warning';
  } else if (['REVOKED', 'CREDENTIAL_REVOKED', 'SIGNATURE_INVALID', 'ALTERED', 'COMPROMISED', 'FAILED', 'REJECTED', 'DANGER', 'CRITICAL', 'SUSPENDED'].includes(norm)) {
    type = 'danger';
  }

  return (
    <span className={`status-badge ${type} ${className}`}>
      <span className="pulse-dot"></span>
      {label || status || 'UNKNOWN'}
    </span>
  );
}
