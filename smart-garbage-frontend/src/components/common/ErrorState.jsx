// src/components/common/ErrorState.jsx
import React from 'react';
import { Alert, Button } from 'react-bootstrap';

function ErrorState({ message, onRetry }) {
  return (
    <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <span>
        <i className="fas fa-exclamation-triangle me-2" aria-hidden="true"></i>
        {message}
      </span>
      {onRetry && (
        <Button variant="outline-danger" size="sm" onClick={onRetry}>
          <i className="fas fa-redo me-1" aria-hidden="true"></i>Retry
        </Button>
      )}
    </Alert>
  );
}

export default ErrorState;
