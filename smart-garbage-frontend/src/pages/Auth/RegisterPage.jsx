// src/pages/Auth/RegisterPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert, Row, Col } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'citizen',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', {
        email: formData.email,
        password: formData.password,
      });

      toast.success('Registration successful! Logging you in...');

      // Auto-login after registration
      const loginResponse = await apiClient.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      const { user_id, name, email: userEmail, role, accessToken, refreshToken } = loginResponse.data;
      login({ user_id, name, email: userEmail, role }, accessToken, refreshToken);

      navigate(role === 'citizen' ? '/citizen/dashboard' : '/login');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Registration failed. Please try again.';
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
            <h2 className="mt-3 fw-bold">Create Account</h2>
            <p className="text-muted">Join Smart Garbage System</p>
          </div>

          {generalError && <Alert variant="danger">{generalError}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                isInvalid={!!errors.email}
              />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                name="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                isInvalid={!!errors.password}
              />
              <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
            </Form.Group>

            <p className="small text-muted mb-4">
              <i className="fas fa-user me-1"></i> Accounts are created for citizens. Officer and admin accounts are issued by your municipality administrator.
            </p>

            <Button
              variant="success"
              type="submit"
              className="w-100 py-2 fw-bold"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Form>

          <hr />

          <div className="text-center">
            <p className="small text-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-success fw-bold">
                Login here
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default RegisterPage;
