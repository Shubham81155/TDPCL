// src/pages/Admin/Wards.jsx
import React from 'react';
import { Container, Alert } from 'react-bootstrap';

function AdminWards() {
  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-map me-2 text-success"></i>
        Ward Management
      </h2>
      <Alert variant="info">
        <i className="fas fa-info-circle me-2"></i>
        Manage administrative wards, set boundaries, and assign officers to specific areas.
      </Alert>
      <div className="card border-0 shadow-lg">
        <div className="card-body text-center py-5">
          <p className="text-muted">Ward management with boundary visualization</p>
        </div>
      </div>
    </Container>
  );
}

export default AdminWards;
