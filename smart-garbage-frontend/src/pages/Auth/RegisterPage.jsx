// src/pages/Auth/RegisterPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
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
  const { t } = useTranslation();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    // Errors hold catalog keys and are translated at render, so they follow a language switch.
    if (!formData.email) newErrors.email = 'auth.errors.emailRequired';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'auth.errors.emailInvalid';
    if (!formData.password) newErrors.password = 'auth.errors.passwordRequired';
    else if (formData.password.length < 6) newErrors.password = 'auth.errors.passwordTooShort';
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
      await apiClient.post('/auth/register', {
        email: formData.email,
        password: formData.password,
      });

      toast.success(t('auth.register.success'));

      // Auto-login after registration
      const loginResponse = await apiClient.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      const { user_id, name, email: userEmail, role, accessToken, refreshToken } = loginResponse.data;
      login({ user_id, name, email: userEmail, role }, accessToken, refreshToken);

      navigate(role === 'citizen' ? '/citizen/dashboard' : '/login');
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('auth.register.failed'); // server messages are shown as returned (English)
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
            <h2 className="mt-3 fw-bold">{t('auth.register.title')}</h2>
            <p className="text-muted">{t('auth.register.subtitle')}</p>
          </div>

          {generalError && <Alert variant="danger">{generalError}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>{t('auth.emailLabel')}</Form.Label>
              <Form.Control
                type="email"
                name="email"
                placeholder={t('auth.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
                isInvalid={!!errors.email}
              />
              <Form.Control.Feedback type="invalid">{errors.email && t(errors.email)}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('auth.passwordLabel')}</Form.Label>
              <Form.Control
                type="password"
                name="password"
                placeholder={t('auth.register.passwordPlaceholder')}
                value={formData.password}
                onChange={handleChange}
                isInvalid={!!errors.password}
              />
              <Form.Control.Feedback type="invalid">{errors.password && t(errors.password)}</Form.Control.Feedback>
            </Form.Group>

            <p className="small text-muted mb-4">
              <i className="fas fa-user me-1"></i> {t('auth.register.note')}
            </p>

            <Button
              variant="success"
              type="submit"
              className="w-100 py-2 fw-bold"
              disabled={isLoading}
            >
              {isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          </Form>

          <hr />

          <div className="text-center">
            <p className="small text-muted">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="text-success fw-bold">
                {t('auth.loginHere')}
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default RegisterPage;
