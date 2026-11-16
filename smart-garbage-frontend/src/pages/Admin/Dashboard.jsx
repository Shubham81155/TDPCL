// src/pages/Admin/Dashboard.jsx
import React, { useMemo } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import useDateRange from '../../hooks/useDateRange';
import { useTranslation } from '../../i18n/LanguageContext';
import DateRangeFilter, { describeRangeText } from '../../components/admin/DateRangeFilter';
import { useAdminStats } from '../../hooks/useAdminStats';
import { errorMessage } from '../../hooks/queryUtils';
import StatCard from '../../components/common/StatCard';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';

ChartJS.register(ArcElement, Tooltip, Legend);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const STATUS_META = [
  { key: 'new_count', status: 'new', color: '#17a2b8' },
  { key: 'assigned_count', status: 'assigned', color: '#6f42c1' },
  { key: 'pending_count', status: 'pending', color: '#ffc107' },
  { key: 'in_progress_count', status: 'in_progress', color: '#fd7e14' },
  { key: 'resolved_count', status: 'resolved', color: '#28a745' },
  { key: 'rejected_count', status: 'rejected', color: '#6c757d' },
];

const LINK_STYLE = { minHeight: 44 };

function AdminDashboard() {
  const { t, formatDate, formatNumber } = useTranslation();
  const range = useDateRange();
  const { data: stats, isLoading, error: queryError, refetch } = useAdminStats(range.params);
  const error = queryError ? errorMessage(queryError, t('admin.dashboard.loadError')) : null;

  const data = useMemo(() => {
    if (!stats) return null;
    const total = num(stats.total_complaints);
    const resolved = num(stats.resolved_count);
    const high = num(stats.high_urgency_count);
    return {
      total,
      resolved,
      high,
      avgHours: num(stats.avg_resolution_hours),
      resolutionRate: total ? (resolved / total) * 100 : 0,
      highPct: total ? (high / total) * 100 : 0,
      statuses: STATUS_META.map((s) => ({ ...s, label: t(`status.${s.status}`), value: num(stats[s.key]) })),
    };
  }, [stats, t]);

  const chartTotal = data ? data.statuses.reduce((a, s) => a + s.value, 0) : 0;

  const chartData = data && {
    labels: data.statuses.map((s) => s.label),
    datasets: [
      {
        data: data.statuses.map((s) => s.value),
        backgroundColor: data.statuses.map((s) => s.color),
        borderWidth: 2,
        borderColor: 'rgba(128,128,128,0.4)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: { legend: { position: 'bottom' } },
  };

  const chartSummary = data
    ? t('admin.dashboard.chartSummary', {
        items: data.statuses.map((s) => `${s.label} ${formatNumber(s.value)}`).join(', '),
      })
    : '';

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="h2 fw-bold mb-2">
            <i className="fas fa-chart-line me-2 text-success" aria-hidden="true"></i>
            {t('admin.dashboard.title')}
          </h1>
          <p className="text-body-secondary mb-3">
            {t('admin.dashboard.subtitle')}
            <span className="ms-2 badge text-bg-secondary" data-testid="active-range">
              {describeRangeText(t, formatDate, range.from, range.to)}
            </span>
          </p>
          <DateRangeFilter
            idPrefix="dash-range"
            from={range.from}
            to={range.to}
            setRange={range.setRange}
            clear={range.clear}
          />
        </Col>
      </Row>

      {isLoading ? (
        <LoadingState variant="cards" label={t('admin.dashboard.loading')} />
      ) : error || !data ? (
        <ErrorState message={error || t('admin.dashboard.noStats')} onRetry={() => refetch()} />
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col xs={6} lg={3}>
              <StatCard icon="inbox" title={t('admin.dashboard.totalComplaints')} value={formatNumber(data.total)} />
            </Col>
            <Col xs={6} lg={3}>
              <StatCard icon="exclamation-circle" title={t('status.new')} value={formatNumber(data.statuses[0].value)} color="#17a2b8" />
            </Col>
            <Col xs={6} lg={3}>
              <StatCard
                icon="spinner"
                title={t('status.in_progress')}
                value={formatNumber(num(stats.in_progress_count))}
                color="#fd7e14"
              />
            </Col>
            <Col xs={6} lg={3}>
              <StatCard icon="check-circle" title={t('status.resolved')} value={formatNumber(data.resolved)} color="#1e7e34" />
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} md={4}>
              <StatCard
                icon="percentage"
                title={t('common.resolutionRate')}
                value={`${data.resolutionRate.toFixed(1)}%`}
                color="#28a745"
                hint={t('admin.dashboard.resolvedOf', { resolved: formatNumber(data.resolved), total: formatNumber(data.total) })}
              />
            </Col>
            <Col xs={6} md={4}>
              <StatCard
                icon="fire"
                title={t('admin.dashboard.highUrgency')}
                value={formatNumber(data.high)}
                color="#dc3545"
                hint={t('admin.dashboard.pctOfTotal', { pct: data.highPct.toFixed(1) })}
              />
            </Col>
            <Col xs={6} md={4}>
              <StatCard
                icon="clock"
                title={t('admin.dashboard.avgResolution')}
                value={t('admin.dashboard.hoursShort', { hours: data.avgHours.toFixed(1) })}
                color="#17a2b8"
              />
            </Col>
          </Row>

          <Row className="g-3">
            <Col lg={7}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-body-tertiary">
                  <Card.Title as="h3" className="mb-0 h5">{t('admin.dashboard.statusDistribution')}</Card.Title>
                </Card.Header>
                <Card.Body>
                  {chartTotal === 0 ? (
                    <p className="text-body-secondary text-center my-5" role="status">
                      {range.from || range.to ? t('admin.dashboard.emptyRange') : t('admin.dashboard.empty')}
                    </p>
                  ) : (
                    <>
                      <div style={{ position: 'relative', height: 'min(300px, 70vw)', minHeight: 220 }}>
                        <Doughnut
                          data={chartData}
                          options={chartOptions}
                          role="img"
                          aria-label={chartSummary}
                        >
                          {chartSummary}
                        </Doughnut>
                      </div>
                      <p className="visually-hidden">{chartSummary}</p>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col lg={5}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-body-tertiary">
                  <Card.Title as="h3" className="mb-0 h5">{t('admin.dashboard.quickLinks')}</Card.Title>
                </Card.Header>
                <Card.Body className="d-grid gap-2 align-content-start">
                  <Link to="/admin/complaints" style={LINK_STYLE} className="btn btn-success d-flex align-items-center justify-content-center">
                    <i className="fas fa-tasks me-2" aria-hidden="true"></i>{t('admin.dashboard.manageComplaints')}
                  </Link>
                  <Link to="/admin/map" style={LINK_STYLE} className="btn btn-outline-success d-flex align-items-center justify-content-center">
                    <i className="fas fa-map-marked-alt me-2" aria-hidden="true"></i>{t('admin.dashboard.viewMap')}
                  </Link>
                  <Link to="/admin/officers" style={LINK_STYLE} className="btn btn-outline-success d-flex align-items-center justify-content-center">
                    <i className="fas fa-users me-2" aria-hidden="true"></i>{t('admin.dashboard.manageOfficers')}
                  </Link>
                  <Link to="/admin/reports" style={LINK_STYLE} className="btn btn-outline-success d-flex align-items-center justify-content-center">
                    <i className="fas fa-file-csv me-2" aria-hidden="true"></i>{t('admin.dashboard.generateReports')}
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default AdminDashboard;
