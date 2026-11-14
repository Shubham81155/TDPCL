// src/components/common/StatusBadge.jsx
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { statusLabel, urgencyLabel } from '../../i18n/labels';

// Status is conveyed by icon + text, never colour alone.
export const STATUS_ICONS = {
  new: 'fa-solid fa-circle-plus',
  assigned: 'fa-solid fa-user-check',
  pending: 'fa-solid fa-clock',
  in_progress: 'fa-solid fa-spinner',
  resolved: 'fa-solid fa-circle-check',
  rejected: 'fa-solid fa-circle-xmark',
  unknown: 'fa-solid fa-circle-question',
};

export const URGENCY_ICONS = {
  low: 'fa-solid fa-arrow-down',
  medium: 'fa-solid fa-minus',
  high: 'fa-solid fa-triangle-exclamation',
};

// Styling comes from the `.status-<status>` rules in styles/index.css.
function StatusBadge({ status, className = '' }) {
  const { t } = useTranslation();
  const label = statusLabel(t, status);
  const cls = status ? `status-${status}` : 'bg-secondary';
  const icon = STATUS_ICONS[status] || STATUS_ICONS.unknown;
  return (
    <span className={`badge ${cls} ${className}`.trim()}>
      <i className={`${icon} me-1`} aria-hidden="true"></i>
      {label}
    </span>
  );
}

export function UrgencyBadge({ urgency, className = '' }) {
  const { t } = useTranslation();
  const level = urgency ? String(urgency).toLowerCase() : '';
  const variants = { low: 'bg-success', medium: 'bg-warning text-dark', high: 'bg-danger' };
  return (
    <span className={`badge ${variants[level] || 'bg-secondary'} text-capitalize ${className}`.trim()}>
      <i className={`${URGENCY_ICONS[level] || 'fa-solid fa-circle-question'} me-1`} aria-hidden="true"></i>
      {urgencyLabel(t, urgency)}
    </span>
  );
}

export default StatusBadge;
