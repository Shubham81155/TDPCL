// src/components/common/StatusBadge.jsx
import React from 'react';

// Styling comes from the `.status-<status>` rules in styles/index.css.
function StatusBadge({ status, className = '' }) {
  const label = status ? String(status).replace(/_/g, ' ') : 'unknown';
  const cls = status ? `status-${status}` : 'bg-secondary';
  return <span className={`badge ${cls} ${className}`.trim()}>{label}</span>;
}

export default StatusBadge;
