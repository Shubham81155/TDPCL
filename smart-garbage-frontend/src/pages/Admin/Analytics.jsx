// src/pages/Admin/Analytics.jsx
import React, { useMemo } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAdminAnalytics } from '../../hooks/useAdminStats';
import { errorMessage } from '../../hooks/queryUtils';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { formatComplaintCategory } from '../../utils/classificationUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const GREEN = '#28a745';
const DARK_GREEN = '#1e7e34';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

function ChartCard({ title, headerColor, empty, label, children }) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Header className="text-white" style={{ background: headerColor }}>
        <Card.Title className="mb-0 h5">{title}</Card.Title>
      </Card.Header>
      <Card.Body>
        {empty ? (
          <p className="text-muted text-center my-5">No data available yet.</p>
        ) : (
          <>
            <div style={{ position: 'relative', height: 300 }}>{children}</div>
            <p className="visually-hidden">{label}</p>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

function AdminAnalytics() {
  const { data, isLoading, error: queryError, refetch } = useAdminAnalytics();
  const error = queryError ? errorMessage(queryError, 'Failed to load analytics') : null;

  const categoryStats = useMemo(
    () =>
      (data?.categories || []).map((c) => ({
        label: formatComplaintCategory(c.category),
        count: num(c.count),
        resolved: num(c.resolved),
      })),
    [data]
  );
  const wardStats = useMemo(
    () =>
      (data?.wards || []).map((w) => ({
        id: w.ward_id,
        name: w.name,
        total: num(w.total_complaints),
        resolved: num(w.resolved),
        officers: num(w.officer_count),
      })),
    [data]
  );
  const officers = useMemo(
    () =>
      (data?.officers || []).map((o) => ({
        id: o.officer_id,
        name: o.officer_name || 'Unknown',
        total: num(o.total_complaints),
        resolved: num(o.resolved),
        active: num(o.active),
        avgHours: o.avg_resolution_hours == null ? null : num(o.avg_resolution_hours),
        rate: num(o.resolution_rate),
      })),
    [data]
  );

  const categoryChart = useMemo(
    () => ({
      labels: categoryStats.map((c) => c.label),
      datasets: [
        { label: 'Total', data: categoryStats.map((c) => c.count), backgroundColor: GREEN },
        { label: 'Resolved', data: categoryStats.map((c) => c.resolved), backgroundColor: DARK_GREEN },
      ],
    }),
    [categoryStats]
  );

  const wardChart = useMemo(
    () => ({
      labels: wardStats.map((w) => w.name),
      datasets: [
        { label: 'Total', data: wardStats.map((w) => w.total), backgroundColor: GREEN },
        { label: 'Resolved', data: wardStats.map((w) => w.resolved), backgroundColor: DARK_GREEN },
      ],
    }),
    [wardStats]
  );

  const categoryLabel = `Bar chart of complaints by category: ${categoryStats
    .map((c) => `${c.label} ${c.count} total, ${c.resolved} resolved`)
    .join('; ')}.`;
  const wardLabel = `Bar chart of complaints by ward: ${wardStats
    .map((w) => `${w.name} ${w.total} total, ${w.resolved} resolved`)
    .join('; ')}.`;

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-chart-bar me-2" style={{ color: GREEN }} aria-hidden="true"></i>
        Analytics
      </h2>

      {isLoading ? (
        <LoadingState label="Loading analytics" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => refetch()} />
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col lg={6}>
              <ChartCard
                title="Complaints by Category"
                headerColor={GREEN}
                empty={categoryStats.length === 0}
                label={categoryLabel}
              >
                <Bar data={categoryChart} options={barOptions} role="img" aria-label={categoryLabel}>
                  {categoryLabel}
                </Bar>
              </ChartCard>
            </Col>
            <Col lg={6}>
              <ChartCard
                title="Complaints by Ward"
                headerColor={DARK_GREEN}
                empty={wardStats.length === 0}
                label={wardLabel}
              >
                <Bar data={wardChart} options={barOptions} role="img" aria-label={wardLabel}>
                  {wardLabel}
                </Bar>
              </ChartCard>
            </Col>
          </Row>

          <Row className="g-3">
            <Col>
              <Card className="border-0 shadow-sm">
                <Card.Header className="text-white" style={{ background: GREEN }}>
                  <Card.Title className="mb-0 h5">Officer Performance (Top 10)</Card.Title>
                </Card.Header>
                <Card.Body>
                  {officers.length === 0 ? (
                    <p className="text-muted text-center my-4">No officer data available yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0">
                        <caption className="visually-hidden">
                          Top officers ranked by resolved complaints
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">Officer</th>
                            <th scope="col" className="text-end">Total</th>
                            <th scope="col" className="text-end">Resolved</th>
                            <th scope="col" className="text-end">Active</th>
                            <th scope="col" className="text-end">Avg Hours</th>
                            <th scope="col" className="text-end">Resolution Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {officers.map((o, idx) => (
                            <tr key={o.id ?? idx}>
                              <td>{idx + 1}</td>
                              <td className="fw-bold">{o.name}</td>
                              <td className="text-end">{o.total}</td>
                              <td className="text-end">{o.resolved}</td>
                              <td className="text-end">{o.active}</td>
                              <td className="text-end">{o.avgHours == null ? '-' : o.avgHours.toFixed(1)}</td>
                              <td className="text-end">
                                <span className="badge" style={{ background: GREEN }}>
                                  {o.rate.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {wardStats.length > 0 && (
            <Row className="g-3 mt-1">
              <Col>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="text-white" style={{ background: DARK_GREEN }}>
                    <Card.Title className="mb-0 h5">Ward Details</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th scope="col">Ward</th>
                            <th scope="col" className="text-end">Total</th>
                            <th scope="col" className="text-end">Resolved</th>
                            <th scope="col" className="text-end">Officers</th>
                            <th scope="col" className="text-end">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wardStats.map((w, idx) => (
                            <tr key={w.id ?? idx}>
                              <td className="fw-bold">{w.name}</td>
                              <td className="text-end">{w.total}</td>
                              <td className="text-end">{w.resolved}</td>
                              <td className="text-end">{w.officers}</td>
                              <td className="text-end">
                                <span className="badge" style={{ background: GREEN }}>
                                  {pct(w.resolved, w.total)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </Container>
  );
}

export default AdminAnalytics;
