// src/components/common/EmptyState.jsx
import React from 'react';

function EmptyState({ icon = 'inbox', message, children }) {
  return (
    <div className="text-center py-5">
      <i className={`fas fa-${icon} fa-2x text-muted mb-2 d-block`} aria-hidden="true"></i>
      <p className="text-muted mb-0">{message}</p>
      {children}
    </div>
  );
}

export default EmptyState;
