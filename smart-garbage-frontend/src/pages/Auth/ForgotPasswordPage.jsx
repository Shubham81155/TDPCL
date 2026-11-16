// src/pages/Auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';
import { useTranslation } from '../../i18n/LanguageContext';
import './Auth.css';

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.forgot.emailRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.status === 429
        ? t('auth.forgot.tooMany')
        : t('auth.forgot.failed');
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
            <h1 className="h2 mt-3 fw-bold">{t('auth.forgot.title')}</h1>
            <p className="text-muted">{t('auth.forgot.subtitle')}</p>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          {!submitted ? (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-4">
                <Form.Label>{t('auth.emailLabel')}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
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
                {isLoading ? t('auth.forgot.sending') : t('auth.forgot.submit')}
              </Button>
            </Form>
          ) : (
            <Alert variant="success" className="text-center">
              <h5 className="mb-3">{t('auth.forgot.sentTitle')}</h5>
              <p>{t('auth.forgot.sentText')}</p>
            </Alert>
          )}

          <hr />

          <div className="text-center">
            <p className="small text-muted">
              {t('auth.forgot.remember')}{' '}
              <Link to="/login" className="text-success fw-bold">
                {t('auth.loginHere')}
              </Link>
            </p>
            <p className="small text-muted">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-success fw-bold">
                {t('auth.registerHere')}
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ForgotPasswordPage;
