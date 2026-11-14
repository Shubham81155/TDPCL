// src/components/common/ErrorState.jsx
import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useTranslation } from '../../i18n/LanguageContext';

function ErrorState({ message, onRetry }) {
  const { t } = useTranslation();
  return (
    <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <span>
        <i className="fas fa-exclamation-triangle me-2" aria-hidden="true"></i>
        {message}
      </span>
      {onRetry && (
        <Button variant="outline-danger" size="sm" onClick={onRetry}>
          <i className="fas fa-redo me-1" aria-hidden="true"></i>{t('common.retry')}
        </Button>
      )}
    </Alert>
  );
}

export default ErrorState;
