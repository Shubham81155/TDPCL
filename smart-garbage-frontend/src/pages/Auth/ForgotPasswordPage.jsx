// src/pages/Auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';
import './Auth.css';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.status === 429
        ? 'Too many attempts. Please try again later.'
        : 'Failed to process request. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="auth-container">
      <Card className="auth-card shadow-lg">
        <Card.Body className="p-5">
          <div className="text-center mb-4">
            <i className="fas fa-lock text-warning" style={{ fontSize: '3rem' }}></i>
            <h2 className="mt-3 fw-bold">Reset Password</h2>
            <p className="text-muted">Enter your email to receive reset instructions</p>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          {!submitted ? (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-4">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Form.Group>

              <Button
                variant="warning"
                type="submit"
                className="w-100 py-2 fw-bold"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </Form>
          ) : (
            <Alert variant="success" className="text-center">
              <h5 className="mb-3">Check Your Email!</h5>
              <p>If an account exists for that email, we've sent password reset instructions. Please check your inbox (the link expires in 1 hour).</p>
            </Alert>
          )}

          <hr />

          <div className="text-center">
            <p className="small text-muted">
              Remember your password?{' '}
              <Link to="/login" className="text-success fw-bold">
                Login here
              </Link>
            </p>
            <p className="small text-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-success fw-bold">
                Register here
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ForgotPasswordPage;
