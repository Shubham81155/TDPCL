// src/pages/Auth/ResetPasswordPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';
import { useTranslation } from '../../i18n/LanguageContext';
import './Auth.css';

function ResetPasswordPage() {
  const { t } = useTranslation();
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
      setError(t('auth.errors.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: password });
      toast.success(t('auth.reset.success'));
      navigate('/login', { replace: true });
    } catch (err) {
      if (err.response?.status === 429) {
        setError(t('auth.reset.tooMany'));
      } else if (err.response?.status === 400 && /token/i.test(err.response?.data?.error || '')) {
        setTokenInvalid(true);
      } else {
        // server messages are shown as returned (English)
        setError(err.response?.data?.error || t('auth.reset.failed'));
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
            <h1 className="h2 mt-3 fw-bold">{t('auth.reset.title')}</h1>
          </div>

          {showInvalid ? (
            <Alert variant="danger" className="text-center">
              <h5 className="mb-3">{t('auth.reset.invalidTitle')}</h5>
              <p>{t('auth.reset.invalidText')}</p>
              <Link to="/forgot-password" className="btn btn-warning fw-bold">
                {t('auth.reset.requestNew')}
              </Link>
            </Alert>
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('auth.reset.newPassword')}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder={t('auth.reset.newPasswordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label>{t('auth.reset.confirm')}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder={t('auth.reset.confirmPlaceholder')}
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
                  {isLoading ? t('auth.reset.submitting') : t('auth.reset.submit')}
                </Button>
              </Form>
            </>
          )}

          <hr />
          <div className="text-center">
            <p className="small text-muted">
              <Link to="/login" className="text-success fw-bold">
                {t('auth.reset.back')}
              </Link>
            </p>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ResetPasswordPage;
