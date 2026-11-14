// src/components/Layout/Footer.jsx
import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer mt-auto py-3 bg-dark text-white">
      <Container>
        <Row>
          <Col md={3} sm={6} className="mb-3">
            <h6 className="fw-bold mb-2">
              <i className="fas fa-trash me-2"></i>
              About System
            </h6>
            <p className="small">
              Smart Garbage Reporting & Municipality Automation System for efficient waste management.
            </p>
          </Col>

          <Col md={3} sm={6} className="mb-3">
            <h6 className="fw-bold mb-2">Quick Links</h6>
            <ul className="list-unstyled small">
              <li>
                <a href="#" className="text-decoration-none text-light">
                  Home
                </a>
              </li>
              <li>
                <a href="#" className="text-decoration-none text-light">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-decoration-none text-light">
                  Contact
                </a>
              </li>
            </ul>
          </Col>

          <Col md={3} sm={6} className="mb-3">
            <h6 className="fw-bold mb-2">Contact</h6>
            <p className="small">
              <i className="fas fa-phone me-2"></i>
              +91 1234567890
              <br />
              <i className="fas fa-envelope me-2"></i>
              support@smartgarbage.in
            </p>
          </Col>

          <Col md={3} sm={6} className="mb-3">
            <h6 className="fw-bold mb-2">Follow Us</h6>
            <div>
              <a href="#" className="text-light me-3">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="#" className="text-light me-3">
                <i className="fab fa-twitter"></i>
              </a>
              <a href="#" className="text-light me-3">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="#" className="text-light">
                <i className="fab fa-linkedin-in"></i>
              </a>
            </div>
          </Col>
        </Row>

        <hr className="bg-secondary" />

        <Row>
          <Col className="text-center small">
            <p>
              &copy; {currentYear} Smart Garbage System. All rights reserved.
              <br />
              <a href="#" className="text-decoration-none text-light">
                Privacy Policy
              </a>
              |
              <a href="#" className="text-decoration-none text-light ms-2">
                Terms of Service
              </a>
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

export default Footer;
