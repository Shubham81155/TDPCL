// src/components/common/PageHeader.jsx
import React from 'react';
import { Row, Col } from 'react-bootstrap';

function PageHeader({ icon, title, subtitle, actions, iconClassName = 'text-success' }) {
  return (
    <Row className="mb-4">
      <Col>
        <h2 className="fw-bold mb-2">
          {icon && <i className={`fas fa-${icon} me-2 ${iconClassName}`} aria-hidden="true"></i>}
          {title}
        </h2>
        {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
      </Col>
      {actions && <Col md="auto">{actions}</Col>}
    </Row>
  );
}

export default PageHeader;
