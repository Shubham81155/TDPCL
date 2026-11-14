// src/pages/Admin/Analytics.jsx
import React, { useMemo } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
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
import useDateRange, { describeRange } from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
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

// Colour reflects how good the rate is; grey when there is nothing to measure yet.
const rateColor = (rate, total) => {
  if (!total) return '#6c757d';
  if (rate >= 70) return '#28a745';
  if (rate >= 40) return '#e0a800';
  return '#dc3545';
};

const HINT = 'click to view these complaints';

// Link into the complaints page with the given filter plus the active date range.
export const complaintsLink = (filters, range) => {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  if (range?.from) p.set('from', range.from);
  if (range?.to) p.set('to', range.to);
  return `/admin/complaints?${p.toString()}`;
};

const makeBarOptions = (onBarClick) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  onClick: (_evt, elements) => {
    if (elements && elements.length) onBarClick(elements[0].index);
  },
  onHover: (evt, elements) => {
    const target = evt?.native?.target;
    if (target && target.style) target.style.cursor = elements && elements.length ? 'pointer' : 'default';
  },
});

function ChartCard({ title, empty, label, links, children }) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Header className="bg-body-tertiary">
        <Card.Title className="mb-0 h5">{title}</Card.Title>
        {!empty && <small className="text-muted">Tip: {HINT}</small>}
      </Card.Header>
      <Card.Body>
        {empty ? (
          <p className="text-muted text-center my-5">No data available yet.</p>
        ) : (
          <>
            <div style={{ position: 'relative', height: 300 }}>{children}</div>
            <p className="visually-hidden">{label}</p>
            {links && links.length > 0 && (
              <ul className="list-unstyled mb-0 visually-hidden-focusable d-flex flex-wrap gap-2 small" aria-label={`${title}: ${HINT}`}>
                {links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>{l.text}</Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}

function AdminAnalytics() {
  const range = useDateRange();
  const navigate = useNavigate();
  const { data, isLoading, error: queryError, refetch } = useAdminAnalytics(range.params);
  const error = queryError ? errorMessage(queryError, 'Failed to load analytics') : null;

  const categoryStats = useMemo(
    () =>
      (data?.categories || []).map((c) => ({
        value: c.category,
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

  const categoryHref = (c) => complaintsLink({ category: c.value }, range);
  const wardHref = (w) => complaintsLink({ ward: w.id }, range);
  const officerHref = (o) => (o.id != null ? complaintsLink({ officer: o.id }, range) : null);

  const categoryOptions = makeBarOptions((i) => {
    const c = categoryStats[i];
    if (c && c.value) navigate(categoryHref(c));
  });
  const wardOptions = makeBarOptions((i) => {
    const w = wardStats[i];
    if (w && w.id != null) navigate(wardHref(w));
  });

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

  const categoryLabel = `Bar chart of complaints by category (${HINT}): ${categoryStats
    .map((c) => `${c.label} ${c.count} total, ${c.resolved} resolved`)
    .join('; ')}.`;
  const wardLabel = `Bar chart of complaints by ward (${HINT}): ${wardStats
    .map((w) => `${w.name} ${w.total} total, ${w.resolved} resolved`)
    .join('; ')}.`;

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-chart-bar me-2" style={{ color: GREEN }} aria-hidden="true"></i>
        Analytics
      </h2>
      <div className="mb-2 text-muted small">
        Showing: <span className="badge text-bg-secondary">{describeRange(range.from, range.to)}</span>
      </div>
      <div className="mb-4">
        <DateRangeFilter
          idPrefix="analytics-range"
          from={range.from}
          to={range.to}
          setRange={range.setRange}
          clear={range.clear}
        />
      </div>

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
                empty={categoryStats.length === 0}
                label={categoryLabel}
                links={categoryStats.filter((c) => c.value).map((c) => ({ to: categoryHref(c), text: `${c.label} (${HINT})` }))}
              >
                <Bar data={categoryChart} options={categoryOptions} role="img" aria-label={categoryLabel}>
                  {categoryLabel}
                </Bar>
              </ChartCard>
            </Col>
            <Col lg={6}>
              <ChartCard
                title="Complaints by Ward"
                empty={wardStats.length === 0}
                label={wardLabel}
              >
                <Bar data={wardChart} options={wardOptions} role="img" aria-label={wardLabel}>
                  {wardLabel}
                </Bar>
              </ChartCard>
            </Col>
          </Row>

          <Row className="g-3">
            <Col>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-body-tertiary">
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
                              <td className="fw-bold">
                                {officerHref(o) ? (
                                  <Link to={officerHref(o)} title={HINT} aria-label={`${o.name}: ${HINT}`}>
                                    {o.name}
                                  </Link>
                                ) : (
                                  o.name
                                )}
                              </td>
                              <td className="text-end">{o.total}</td>
                              <td className="text-end">{o.resolved}</td>
                              <td className="text-end">{o.active}</td>
                              <td className="text-end">{o.avgHours == null ? '-' : o.avgHours.toFixed(1)}</td>
                              <td className="text-end">
                                <span className="badge" style={{ background: rateColor(o.rate, o.total) }}>
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
                  <Card.Header className="bg-body-tertiary">
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
                              <td className="fw-bold">
                                {w.id != null ? (
                                  <Link to={wardHref(w)} title={HINT} aria-label={`${w.name}: ${HINT}`}>
                                    {w.name}
                                  </Link>
                                ) : (
                                  w.name
                                )}
                              </td>
                              <td className="text-end">{w.total}</td>
                              <td className="text-end">{w.resolved}</td>
                              <td className="text-end">{w.officers}</td>
                              <td className="text-end">
                                <span className="badge" style={{ background: rateColor(pct(w.resolved, w.total), w.total) }}>
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
