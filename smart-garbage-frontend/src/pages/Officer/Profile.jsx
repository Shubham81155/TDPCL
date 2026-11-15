// src/pages/Officer/Profile.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form } from 'react-bootstrap';
import LoadingState from '../../components/common/LoadingState';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

function OfficerProfile() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfileAndMetrics();
    // Load once on mount; a language switch must not re-fetch the profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfileAndMetrics = async () => {
    try {
      const profileResponse = await apiClient.get('/officers/me');
      setProfile(profileResponse.data.officer);

      const metricsResponse = await apiClient.get('/officers/me/metrics');
      setMetrics(metricsResponse.data.metrics);
    } catch (error) {
      toast.error(t('officer.profile.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Container className="py-4">
        <LoadingState variant="detail" label={t('officer.profile.loading')} />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row>
        <Col lg={8} className="mx-auto">
          <Card className="border-0 shadow-lg mb-4">
            <Card.Header className="bg-primary text-white">
              <Card.Title as="h1" className="h4 mb-0">{t('officer.profile.title')}</Card.Title>
            </Card.Header>

            <Card.Body>
              <Row>
                <Col md={3} className="text-center mb-4">
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      backgroundColor: '#007bff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      color: 'white',
                      fontSize: '2rem',
                    }}
                  >
                    <i className="fas fa-user"></i>
                  </div>
                </Col>

                <Col md={9}>
                  <h4 className="fw-bold mb-1">{profile?.name || user?.name}</h4>
                  <p className="text-muted mb-3">{t('officer.profile.officerId', { id: profile?.employee_id || profile?.officer_id || '-' })}</p>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('officer.profile.email')}</Form.Label>
                      <Form.Control type="email" value={user?.email} disabled />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>{t('officer.profile.phone')}</Form.Label>
                      <Form.Control
                        type="tel"
                        value={profile?.phone || ''}
                        placeholder={t('officer.profile.phonePlaceholder')}
                        disabled
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>{t('officer.profile.ward')}</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile?.ward_name || profile?.assigned_area_name || ''}
                        placeholder={t('officer.profile.wardPlaceholder')}
                        disabled
                      />
                    </Form.Group>
                  </Form>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {metrics && (
            <Card className="border-0 shadow-lg">
              <Card.Header className="bg-success text-white">
                <Card.Title as="h2" className="h5 mb-0">{t('officer.profile.metrics')}</Card.Title>
              </Card.Header>

              <Card.Body>
                <Row>
                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">{t('officer.profile.totalComplaints')}</p>
                    <h4 className="fw-bold text-primary">{metrics.total_complaints}</h4>
                  </Col>

                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">{t('status.resolved')}</p>
                    <h4 className="fw-bold text-success">{metrics.resolved_count}</h4>
                  </Col>

                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">{t('status.in_progress')}</p>
                    <h4 className="fw-bold text-info">{metrics.in_progress_count}</h4>
                  </Col>

                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">{t('officer.profile.avgTime')}</p>
                    <h4 className="fw-bold text-warning">
                      {t('officer.profile.hours', { hours: metrics.avg_resolution_hours })}
                    </h4>
                  </Col>
                </Row>

                <div className="mt-4">
                  <p className="small text-muted mb-1">{t('common.resolutionRate')}</p>
                  <div className="progress">
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{
                        width: `${(metrics.resolved_count / metrics.total_complaints) * 100 || 0}%`,
                      }}
                    >
                      {Math.round((metrics.resolved_count / metrics.total_complaints) * 100 || 0)}%
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default OfficerProfile;
