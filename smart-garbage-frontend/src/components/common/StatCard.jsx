// src/components/common/StatCard.jsx
import React from 'react';
import { Card } from 'react-bootstrap';

function StatCard({ icon, title, value, color = '#28a745', hint }) {
  return (
    <Card className="stat-card border-0 shadow-sm h-100">
      <Card.Body className="text-center p-3 p-md-4">
        <div className="stat-icon mb-2" style={{ color }} aria-hidden="true">
          <i className={`fas fa-${icon}`}></i>
        </div>
        <h6 className="text-muted mb-1">{title}</h6>
        <h3 className="fw-bold mb-0" style={{ color }}>{value}</h3>
        {hint && <small className="text-muted">{hint}</small>}
      </Card.Body>
    </Card>
  );
}

export default StatCard;
