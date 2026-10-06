import React from 'react';
import { 
  ShieldCheck, 
  AlertOctagon, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  CheckCircle2, 
  Sparkles,
  HelpCircle
} from 'lucide-react';

export default function StatusBadge({ status, label, className = '', showIcon = true, size = 'sm' }) {
  const norm = String(status || label || '').trim().toUpperCase();

  let type = 'neutral';
  let Icon = HelpCircle;
  let animClass = '';

  if (['VALID', 'ACTIVE', 'VERIFIED', 'PASSED', 'LEVEL 5 CURRENTLY_VALID', 'CONFIRMED', 'SUCCESS', 'ONLINE', 'HEALTHY'].some(k => norm.includes(k))) {
    type = 'healthy';
    Icon = ShieldCheck;
    animClass = 'status-visual-valid';
  } else if (['TAMPERED', 'ALTERED', 'SIGNATURE_INVALID', 'COMPROMISED', 'HASH_MISMATCH'].some(k => norm.includes(k))) {
    type = 'danger';
    Icon = AlertOctagon;
    animClass = 'status-visual-tampered';
  } else if (['EXPIRED', 'OUTDATED'].some(k => norm.includes(k))) {
    type = 'warning';
    Icon = Clock;
    animClass = 'status-visual-expired';
  } else if (['REVOKED', 'CREDENTIAL_REVOKED', 'FAILED', 'REJECTED', 'CRITICAL', 'SUSPENDED'].some(k => norm.includes(k))) {
    type = 'danger';
    Icon = XCircle;
    animClass = 'status-visual-revoked';
  } else if (['PENDING', 'MANUAL_REVIEW', 'SOURCE_FOUND', 'LEVEL 1 SOURCE_FOUND', 'LEVEL 2 SOURCE_VERIFIED', 'WARNING', 'UNAVAILABLE', 'EVALUATING'].some(k => norm.includes(k))) {
    type = 'warning';
    Icon = AlertTriangle;
  }

  const displayText = label || status || 'UNKNOWN';

  return (
    <span 
      className={`status-badge ${type} ${animClass} ${size} ${className}`}
      role="status"
      aria-label={`Status: ${displayText}`}
    >
      <span className="pulse-dot" aria-hidden="true"></span>
      {showIcon && <Icon size={size === 'lg' ? 16 : 13} className="badge-icon-svg" aria-hidden="true" />}
      <span className="badge-text">{displayText}</span>
    </span>
  );
}
