// src/pages/Auth/LoginPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from '../../i18n/LanguageContext';
import './Auth.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    // Errors hold catalog keys and are translated at render, so they follow a language switch.
    if (!email) newErrors.email = 'auth.errors.emailRequired';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'auth.errors.emailInvalid';
    if (!password) newErrors.password = 'auth.errors.passwordRequired';
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

      toast.success(t('auth.login.success'));
      navigate(role === 'admin' ? '/admin/dashboard' : role === 'officer' ? '/officer/dashboard' : '/citizen/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('auth.login.failed'); // server messages are shown as returned (English)
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
            <h1 className="h2 mt-3 fw-bold">{t('common.brand')}</h1>
            <p className="text-muted">{t('auth.login.subtitle')}</p>
          </div>

          {generalError && <Alert variant="danger">{generalError}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>{t('auth.emailLabel')}</Form.Label>
              <Form.Control
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isInvalid={!!errors.email}
              />
              <Form.Control.Feedback type="invalid">{errors.email && t(errors.email)}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('auth.passwordLabel')}</Form.Label>
              <Form.Control
                type="password"
                placeholder={t('auth.login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isInvalid={!!errors.password}
              />
              <Form.Control.Feedback type="invalid">{errors.password && t(errors.password)}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check type="checkbox" label={t('auth.login.remember')} />
            </Form.Group>

            <Button
              variant="success"
              type="submit"
              className="w-100 py-2 fw-bold"
              disabled={isLoading}
            >
              {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </Form>

          <hr />

          <div className="text-center">
            <p className="small text-muted">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-success fw-bold">
                {t('auth.registerHere')}
              </Link>
            </p>
            <p className="small text-muted">
              <Link to="/forgot-password" className="text-secondary">
                {t('auth.login.forgot')}
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default LoginPage;
