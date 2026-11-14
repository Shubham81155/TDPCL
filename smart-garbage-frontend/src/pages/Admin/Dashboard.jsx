// src/pages/Admin/Dashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Spinner, Button, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

ChartJS.register(ArcElement, Tooltip, Legend);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const STATUS_META = [
  { key: 'new_count', label: 'New', color: '#17a2b8' },
  { key: 'assigned_count', label: 'Assigned', color: '#6f42c1' },
  { key: 'pending_count', label: 'Pending', color: '#ffc107' },
  { key: 'in_progress_count', label: 'In Progress', color: '#fd7e14' },
  { key: 'resolved_count', label: 'Resolved', color: '#28a745' },
  { key: 'rejected_count', label: 'Rejected', color: '#6c757d' },
];

function StatCard({ icon, title, value, color = '#28a745', hint }) {
  return (
    <Card className="stat-card border-0 shadow-sm h-100">
      <Card.Body className="text-center p-3 p-md-4">
        <div className="stat-icon mb-2" style={{ color }} aria-hidden="true">
          <i className={`fas fa-${icon}`}></i>
        </div>
        <h6 className="text-muted mb-1">{title}</h6>
        <h3 className="fw-bold mb-0" style={{ color }}>{value}</h3>
        {hint && <small className="text-muted">{hint}</small>}
      </Card.Body>
    </Card>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/admin/stats/complaints');
      setStats(response.data.stats || null);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to load statistics';
      setError(msg);
      toast.error('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
      statuses: STATUS_META.map((s) => ({ ...s, value: num(stats[s.key]) })),
    };
  }, [stats]);

  const chartTotal = data ? data.statuses.reduce((a, s) => a + s.value, 0) : 0;

  const chartData = data && {
    labels: data.statuses.map((s) => s.label),
    datasets: [
      {
        data: data.statuses.map((s) => s.value),
        backgroundColor: data.statuses.map((s) => s.color),
        borderWidth: 2,
        borderColor: '#fff',
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
    ? `Doughnut chart of complaint status distribution: ${data.statuses
        .map((s) => `${s.label} ${s.value}`)
        .join(', ')}.`
    : '';

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-chart-line me-2" style={{ color: '#28a745' }} aria-hidden="true"></i>
            Admin Dashboard
          </h2>
          <p className="text-muted mb-0">System-wide statistics and overview</p>
        </Col>
      </Row>

      {isLoading ? (
        <div className="text-center py-5" role="status" aria-live="polite">
          <Spinner animation="border" variant="success" />
          <span className="visually-hidden">Loading statistics</span>
        </div>
      ) : error || !data ? (
        <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>
            <i className="fas fa-exclamation-triangle me-2" aria-hidden="true"></i>
            {error || 'No statistics available.'}
          </span>
          <Button variant="outline-danger" size="sm" onClick={loadStats}>
            <i className="fas fa-redo me-1" aria-hidden="true"></i>Retry
          </Button>
        </Alert>
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col xs={6} lg={3}>
              <StatCard icon="inbox" title="Total Complaints" value={data.total} />
            </Col>
            <Col xs={6} lg={3}>
              <StatCard icon="exclamation-circle" title="New" value={data.statuses[0].value} color="#17a2b8" />
            </Col>
            <Col xs={6} lg={3}>
              <StatCard
                icon="spinner"
                title="In Progress"
                value={num(stats.in_progress_count)}
                color="#fd7e14"
              />
            </Col>
            <Col xs={6} lg={3}>
              <StatCard icon="check-circle" title="Resolved" value={data.resolved} color="#1e7e34" />
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} md={4}>
              <StatCard
                icon="percentage"
                title="Resolution Rate"
                value={`${data.resolutionRate.toFixed(1)}%`}
                color="#28a745"
                hint={`${data.resolved} of ${data.total} resolved`}
              />
            </Col>
            <Col xs={6} md={4}>
              <StatCard
                icon="fire"
                title="High Urgency"
                value={data.high}
                color="#dc3545"
                hint={`${data.highPct.toFixed(1)}% of total`}
              />
            </Col>
            <Col xs={6} md={4}>
              <StatCard
                icon="clock"
                title="Avg Resolution Time"
                value={`${data.avgHours.toFixed(1)}h`}
                color="#17a2b8"
              />
            </Col>
          </Row>

          <Row className="g-3">
            <Col lg={7}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="text-white" style={{ background: '#28a745' }}>
                  <Card.Title className="mb-0 h5">Status Distribution</Card.Title>
                </Card.Header>
                <Card.Body>
                  {chartTotal === 0 ? (
                    <p className="text-muted text-center my-5">No complaints yet.</p>
                  ) : (
                    <>
                      <div style={{ position: 'relative', height: 300 }}>
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
                <Card.Header className="text-white" style={{ background: '#1e7e34' }}>
                  <Card.Title className="mb-0 h5">Quick Links</Card.Title>
                </Card.Header>
                <Card.Body className="d-grid gap-2 align-content-start">
                  <Button as={Link} to="/admin/complaints" variant="success">
                    <i className="fas fa-tasks me-2" aria-hidden="true"></i>Manage Complaints
                  </Button>
                  <Button as={Link} to="/admin/officers" variant="outline-success">
                    <i className="fas fa-users me-2" aria-hidden="true"></i>Manage Officers
                  </Button>
                  <Button as={Link} to="/admin/reports" variant="outline-success">
                    <i className="fas fa-file-csv me-2" aria-hidden="true"></i>Generate Reports
                  </Button>
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
