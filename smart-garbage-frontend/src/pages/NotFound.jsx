// src/pages/NotFound.jsx
import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} className="text-center">
          <div className="mb-4">
            <h1 className="display-1 fw-bold text-danger">404</h1>
            <h2 className="fw-bold mb-2">Page Not Found</h2>
            <p className="text-muted mb-4">The page you're looking for doesn't exist or has been moved.</p>
          </div>

          <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
            <Link to="/">
              <Button variant="success" size="lg">
                <i className="fas fa-home me-2"></i>
                Go to Home
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline-primary" size="lg">
                <i className="fas fa-sign-in-alt me-2"></i>
                Login
              </Button>
            </Link>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default NotFound;
