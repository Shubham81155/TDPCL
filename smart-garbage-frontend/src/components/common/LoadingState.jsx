// src/components/common/LoadingState.jsx
import React from 'react';
import { Spinner } from 'react-bootstrap';

function LoadingState({ label = 'Loading...', variant = 'success', fullPage = false }) {
  return (
    <div
      className="text-center py-5 d-flex justify-content-center align-items-center"
      style={fullPage ? { minHeight: '50vh' } : undefined}
      role="status"
      aria-live="polite"
    >
      <Spinner animation="border" variant={variant} />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export default LoadingState;
