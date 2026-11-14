// src/pages/Auth/LoginPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import './Auth.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { user_id, name, email: userEmail, role, accessToken, refreshToken } = response.data;

      login(
        { user_id, name, email: userEmail, role },
        accessToken,
        refreshToken
      );

      toast.success('Login successful!');
      navigate(role === 'admin' ? '/admin/dashboard' : role === 'officer' ? '/officer/dashboard' : '/citizen/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';
      setGeneralError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="auth-container">
      <Card className="auth-card shadow-lg">
        <Card.Body className="p-5">
          <div className="text-center mb-4">
            <i className="fas fa-trash text-success" style={{ fontSize: '3rem' }}></i>
            <h2 className="mt-3 fw-bold">Smart Garbage System</h2>
            <p className="text-muted">Login to your account</p>
          </div>

          {generalError && <Alert variant="danger">{generalError}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isInvalid={!!errors.email}
              />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isInvalid={!!errors.password}
              />
              <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check type="checkbox" label="Remember me" />
            </Form.Group>

            <Button
              variant="success"
              type="submit"
              className="w-100 py-2 fw-bold"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </Form>

          <hr />

          <div className="text-center">
            <p className="small text-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-success fw-bold">
                Register here
              </Link>
            </p>
            <p className="small text-muted">
              <Link to="/forgot-password" className="text-secondary">
                Forgot your password?
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default LoginPage;
