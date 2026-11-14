// src/pages/Auth/ResetPasswordPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';
import './Auth.css';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password reset successfully. Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many attempts. Please try again later.');
      } else if (err.response?.status === 400 && /token/i.test(err.response?.data?.error || '')) {
        setTokenInvalid(true);
      } else {
        setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showInvalid = !token || tokenInvalid;

  return (
    <Container className="auth-container">
      <Card className="auth-card shadow-lg">
        <Card.Body className="p-5">
          <div className="text-center mb-4">
            <i className="fas fa-key text-warning" style={{ fontSize: '3rem' }}></i>
            <h2 className="mt-3 fw-bold">Choose a New Password</h2>
          </div>

          {showInvalid ? (
            <Alert variant="danger" className="text-center">
              <h5 className="mb-3">Invalid or expired link</h5>
              <p>This password reset link is invalid, has expired, or was already used.</p>
              <Link to="/forgot-password" className="btn btn-warning fw-bold">
                Request a new link
              </Link>
            </Alert>
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </Form.Group>
                <Button
                  variant="warning"
                  type="submit"
                  className="w-100 py-2 fw-bold"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </Form>
            </>
          )}

          <hr />
          <div className="text-center">
            <p className="small text-muted">
              <Link to="/login" className="text-success fw-bold">
                Back to login
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ResetPasswordPage;
