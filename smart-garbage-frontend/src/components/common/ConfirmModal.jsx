// src/components/common/ConfirmModal.jsx
import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useTranslation } from '../../i18n/LanguageContext';

/**
 * Themed, translated replacement for window.confirm.
 * Render it with `show` controlled by the caller; onConfirm/onCancel close it.
 */
function ConfirmModal({ show, title, message, confirmLabel, variant = 'danger', busy = false, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered backdrop="static" aria-labelledby="confirm-modal-title">
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="confirm-modal-title" as="h2" className="h5">
          {title || t('common.confirmTitle')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ minHeight: 44 }}>
          {t('common.cancel')}
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={busy} style={{ minHeight: 44 }}>
          {confirmLabel || t('common.confirm')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmModal;
