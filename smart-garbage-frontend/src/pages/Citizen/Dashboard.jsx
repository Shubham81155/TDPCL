// src/pages/Citizen/Dashboard.jsx
import React, { useMemo } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useMyComplaints, useMyComplaintSummary } from '../../hooks/useComplaints';
import LoadingState from '../../components/common/LoadingState';
import StatCard from '../../components/common/StatCard';
import Skeleton from '../../components/common/Skeleton';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { categoryLabel } from '../../i18n/labels';

const STEP_KEYS = [
  { icon: 'camera', key: 'photo' },
  { icon: 'map-pin', key: 'pin' },
  { icon: 'chart-line', key: 'track' },
];

function CitizenDashboard() {
  const { t, lang, formatNumber } = useTranslation();
  const steps = STEP_KEYS.map((s) => ({
    icon: s.icon,
    title: t(`citizen.dashboard.steps.${s.key}Title`),
    text: t(`citizen.dashboard.steps.${s.key}Text`),
  }));
  const { data, isLoading } = useMyComplaints();
  const { data: summary, isLoading: summaryLoading } = useMyComplaintSummary();
  const { user } = useAuth();

  const { stats, recent } = useMemo(() => {
    const complaints = data || [];
    const counted = {
      // "Pending" = waiting to be worked on (includes complaints already assigned to an officer)
      pending_count: complaints.filter((c) => ['new', 'pending', 'assigned'].includes(c.status)).length,
      in_progress_count: complaints.filter((c) => c.status === 'in_progress').length,
      resolved_count: complaints.filter((c) => c.status === 'resolved').length,
      rejected_count: complaints.filter((c) => c.status === 'rejected').length,
      // every complaint, including rejected ones
      total_count: complaints.length,
    };
    // The server summary is not capped by the list's page size; fall back to counting the list
    const fromSummary = summary
      ? {
          pending_count: Number(summary.pending) || 0,
          in_progress_count: Number(summary.in_progress) || 0,
          resolved_count: Number(summary.resolved) || 0,
          rejected_count: Number(summary.rejected) || 0,
          total_count: Number(summary.total) || 0,
        }
      : null;
    return { stats: fromSummary || counted, recent: complaints.slice(0, 5) };
  }, [data, summary]);

  const statsLoading = isLoading && summaryLoading;
  const isNewCitizen = !isLoading && !statsLoading && stats.total_count === 0 && recent.length === 0;

  const statCards = [
    { id: 'pending', icon: 'clock', title: t('status.pending'), count: stats.pending_count, color: '#b58100' },
    { id: 'in_progress', icon: 'spinner', title: t('status.in_progress'), count: stats.in_progress_count, color: '#0aa2c0' },
    { id: 'resolved', icon: 'check-circle', title: t('status.resolved'), count: stats.resolved_count, color: '#198754' },
    {
      id: 'total',
      icon: 'file',
      title: t('common.total'),
      count: stats.total_count,
      color: '#0d6efd',
      hint:
        stats.rejected_count > 0
          ? t('citizen.dashboard.includesRejected', { count: formatNumber(stats.rejected_count) })
          : undefined,
    },
  ];

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-home me-2 text-success" aria-hidden="true"></i>
            {t('citizen.dashboard.welcome', { name: user?.name || t('citizen.dashboard.citizenFallback') })}
          </h2>
          <p className="text-muted">{t('citizen.dashboard.subtitle')}</p>
        </Col>
        <Col md="auto">
          <Link to="/citizen/complaint/new">
            <Button variant="success" size="lg">
              <i className="fas fa-plus me-2"></i>
              {t('common.reportNewIssue')}
            </Button>
          </Link>
        </Col>
      </Row>

      {statsLoading ? (
        <div className="mb-4">
          <LoadingState variant="cards" label={t('citizen.dashboard.loadingSummary')} />
        </div>
      ) : (
        <Row className="mb-4 g-3">
          {statCards.map((c) => (
            <Col md={3} xs={6} key={c.id}>
              <StatCard icon={c.icon} title={c.title} value={formatNumber(c.count)} color={c.color} hint={c.hint} />
            </Col>
          ))}
        </Row>
      )}

      {isNewCitizen && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="text-center p-4">
            <h4 className="fw-bold mb-1">{t('citizen.dashboard.howItWorks')}</h4>
            <p className="text-muted mb-4">{t('citizen.dashboard.howItWorksSub')}</p>
            <Row className="g-3 mb-4">
              {steps.map((step, i) => (
                <Col md={4} key={step.title}>
                  <div className="d-flex flex-column align-items-center">
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success text-white mb-2"
                      style={{ width: 52, height: 52 }}
                      aria-hidden="true"
                    >
                      <i className={`fa-solid fa-${step.icon}`}></i>
                    </span>
                    <h6 className="fw-bold mb-1">
                      {i + 1}. {step.title}
                    </h6>
                    <p className="text-muted small mb-0">{step.text}</p>
                  </div>
                </Col>
              ))}
            </Row>
            <Link to="/citizen/complaint/new" className="btn btn-success btn-lg">
              <i className="fas fa-plus me-2" aria-hidden="true"></i>
              {t('citizen.dashboard.reportFirst')}
            </Link>
          </Card.Body>
        </Card>
      )}

      <Row className="mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">{t('citizen.dashboard.quickActions')}</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Link to="/citizen/complaint/new">
                  <Button variant="outline-success" className="w-100 text-start">
                    <i className="fas fa-plus me-2"></i>
                    {t('common.reportNewIssue')}
                  </Button>
                </Link>
                <Link to="/citizen/complaints">
                  <Button variant="outline-info" className="w-100 text-start">
                    <i className="fas fa-list me-2"></i>
                    {t('citizen.dashboard.viewAll')}
                  </Button>
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-info text-white">
              <Card.Title className="mb-0">{t('citizen.dashboard.tips')}</Card.Title>
            </Card.Header>
            <Card.Body>
              <ul className="mb-0 small">
                <li className="mb-2">{t('citizen.dashboard.tip1')}</li>
                <li className="mb-2">{t('citizen.dashboard.tip2')}</li>
                <li className="mb-2">{t('citizen.dashboard.tip3')}</li>
                <li>{t('citizen.dashboard.tip4')}</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">{t('citizen.dashboard.recentActivity')}</Card.Title>
            </Card.Header>
            <Card.Body>
              {isLoading ? (
                <Skeleton variant="text" lines={4} label={t('citizen.dashboard.loadingRecent')} />
              ) : recent.length === 0 ? (
                <p className="text-muted mb-0">
                  {t('citizen.dashboard.noneYet')}{' '}
                  <Link to="/citizen/complaint/new">{t('citizen.dashboard.reportFirst')}</Link>
                  {t('common.sentenceEnd')}
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {recent.map((c) => (
                    <Link
                      key={c.complaint_id}
                      to={`/citizen/complaint/${c.complaint_id}`}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0"
                    >
                      <span>
                        <strong>#{c.complaint_id}</strong>{' '}
                        <span className="text-muted">
                          {lang === 'en'
                            ? (c.category || 'garbage').replace(/_/g, ' ')
                            : c.category
                            ? categoryLabel(t, c.category)
                            : t('citizen.dashboard.defaultCategory')}{' '}
                          · {c.area || t('citizen.dashboard.unknownArea')}
                        </span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  ))}
                  <Link to="/citizen/complaints" className="small pt-2">
                    {t('citizen.dashboard.viewAllLink')}
                  </Link>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default CitizenDashboard;
