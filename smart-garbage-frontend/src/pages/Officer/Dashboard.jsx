// src/pages/Officer/Dashboard.jsx
import React, { useMemo } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAssignedComplaints } from '../../hooks/useComplaints';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';

function OfficerDashboard() {
  const { data, isLoading } = useAssignedComplaints();
  const { user } = useAuth();
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const complaints = data || [];
    return {
      pending_count: complaints.filter((c) => c.status === 'assigned' || c.status === 'pending').length,
      in_progress_count: complaints.filter((c) => c.status === 'in_progress').length,
      resolved_count: complaints.filter((c) => c.status === 'resolved').length,
    };
  }, [data]);

  const total = stats.pending_count + stats.in_progress_count + stats.resolved_count;
  const resolutionRate = total ? Math.round((stats.resolved_count / total) * 100) : 0;

  const StatCard = ({ icon, title, count, color, link }) => (
    <Link to={link} className="text-decoration-none">
      <Card className="border-0 shadow-sm h-100 cursor-pointer" style={{ transition: 'all 0.3s ease' }}>
        <Card.Body className="text-center p-4">
          <div className={`text-${color} mb-3`} style={{ fontSize: '2.5rem' }}>
            <i className={`fas fa-${icon}`} aria-hidden="true"></i>
          </div>
          <h6 className="text-muted mb-2">{title}</h6>
          <h3 className={`text-${color} fw-bold`}>{count}</h3>
        </Card.Body>
      </Card>
    </Link>
  );

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-home me-2 text-primary"></i>
            {t('officer.dashboard.title')}
          </h2>
          <p className="text-muted">
            {t('officer.dashboard.welcome', { name: user?.name || t('officer.dashboard.officerFallback') })}
          </p>
        </Col>
      </Row>

      {isLoading ? (
        <LoadingState variant="cards" label={t('officer.dashboard.loading')} />
      ) : (
        <>
          <Row className="mb-4">
            <Col md={3}>
              <StatCard
                icon="clock"
                title={t('status.pending')}
                count={stats.pending_count}
                color="warning"
                link="/officer/complaints?status=pending"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="spinner"
                title={t('status.in_progress')}
                count={stats.in_progress_count}
                color="info"
                link="/officer/complaints?status=in_progress"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="check-circle"
                title={t('status.resolved')}
                count={stats.resolved_count}
                color="success"
                link="/officer/complaints?status=resolved"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="file"
                title={t('common.total')}
                count={stats.pending_count + stats.in_progress_count + stats.resolved_count}
                color="primary"
                link="/officer/complaints"
              />
            </Col>
          </Row>

          {total === 0 && (
            <Card className="border-0 shadow-sm mb-4">
              <EmptyState
                icon="tasks"
                title={t('officer.dashboard.emptyTitle')}
                text={t('officer.dashboard.emptyText')}
                className="py-4"
              />
            </Card>
          )}

          <Row className="mb-4">
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-primary text-white">
                  <Card.Title className="mb-0">{t('officer.dashboard.quickActions')}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <div className="d-grid gap-2">
                    <Link to="/officer/complaints">
                      <Button variant="outline-primary" className="w-100 text-start">
                        <i className="fas fa-tasks me-2"></i>
                        {t('officer.dashboard.viewAll')}
                      </Button>
                    </Link>
                    <Link to="/officer/map">
                      <Button variant="outline-info" className="w-100 text-start">
                        <i className="fas fa-map me-2"></i>
                        {t('nav.mapView')}
                      </Button>
                    </Link>
                    <Link to="/officer/profile">
                      <Button variant="outline-secondary" className="w-100 text-start">
                        <i className="fas fa-user me-2"></i>
                        {t('officer.dashboard.myProfile')}
                      </Button>
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-info text-white">
                  <Card.Title className="mb-0">{t('officer.dashboard.performance')}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <p className="small text-muted mb-1">{t('common.resolutionRate')}</p>
                    <div className="progress">
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        aria-valuenow={resolutionRate}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        style={{ width: `${resolutionRate}%` }}
                      >
                        {resolutionRate}%
                      </div>
                    </div>
                  </div>
                  <p className="small">
                    <i className="fas fa-info-circle me-2"></i>
                    {total === 0
                      ? t('officer.dashboard.noneAssigned')
                      : resolutionRate >= 70
                      ? t('officer.dashboard.keepUp')
                      : t('officer.dashboard.resolvedOf', { resolved: stats.resolved_count, total })}
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default OfficerDashboard;
