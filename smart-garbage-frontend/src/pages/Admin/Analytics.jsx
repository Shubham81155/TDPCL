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
import { useTranslation } from '../../i18n/LanguageContext';
import { categoryLabel } from '../../i18n/labels';
import { useAdminAnalytics } from '../../hooks/useAdminStats';
import useDateRange from '../../hooks/useDateRange';
import DateRangeFilter, { describeRangeText } from '../../components/admin/DateRangeFilter';
import { errorMessage } from '../../hooks/queryUtils';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const GREEN = '#28a745';
const DARK_GREEN = '#1e7e34';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Colour reflects how good the rate is; grey when there is nothing to measure yet.
// Returns a Bootstrap text-bg-* variant (theme aware, AA contrast).
const rateVariant = (rate, total) => {
  if (!total) return 'secondary';
  if (rate >= 70) return 'success';
  if (rate >= 40) return 'warning';
  return 'danger';
};

const RateBadge = ({ rate, total, text }) => (
  <span className={`badge text-bg-${rateVariant(rate, total)}`}>{text}</span>
);

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
  const { t } = useTranslation();
  const hint = t('admin.analytics.hint');
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Header className="bg-body-tertiary">
        <Card.Title as="h3" className="mb-0 h5">{title}</Card.Title>
        {!empty && <small className="text-body-secondary">{t('admin.analytics.tip', { hint })}</small>}
      </Card.Header>
      <Card.Body>
        {empty ? (
          <p className="text-body-secondary text-center my-5" role="status">{t('admin.analytics.noData')}</p>
        ) : (
          <>
            <div style={{ position: 'relative', height: 'min(300px, 80vw)', minHeight: 240 }}>{children}</div>
            <p className="visually-hidden">{label}</p>
            {links && links.length > 0 && (
              <ul className="list-unstyled mb-0 visually-hidden-focusable d-flex flex-wrap gap-2 small" aria-label={`${title}: ${hint}`}>
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
  const { t, formatDate, formatNumber } = useTranslation();
  const range = useDateRange();
  const navigate = useNavigate();
  const { data, isLoading, error: queryError, refetch } = useAdminAnalytics(range.params);
  const error = queryError ? errorMessage(queryError, t('admin.analytics.loadError')) : null;

  const categoryStats = useMemo(
    () =>
      (data?.categories || []).map((c) => ({
        value: c.category,
        label: categoryLabel(t, c.category),
        count: num(c.count),
        resolved: num(c.resolved),
      })),
    [data, t]
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
        name: o.officer_name || t('admin.analytics.unknownOfficer'),
        total: num(o.total_complaints),
        resolved: num(o.resolved),
        active: num(o.active),
        avgHours: o.avg_resolution_hours == null ? null : num(o.avg_resolution_hours),
        rate: num(o.resolution_rate),
      })),
    [data, t]
  );

  const hintText = t('admin.analytics.hint');
  // Link (44px tap area) when a target exists, plain text otherwise.
  const nameLink = (item, href) =>
    href ? (
      <Link to={href} className="d-inline-block py-2" title={hintText} aria-label={`${item.name}: ${hintText}`}>
        {item.name}
      </Link>
    ) : (
      item.name
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
        { label: t('common.total'), data: categoryStats.map((c) => c.count), backgroundColor: GREEN },
        { label: t('status.resolved'), data: categoryStats.map((c) => c.resolved), backgroundColor: DARK_GREEN },
      ],
    }),
    [categoryStats, t]
  );

  const wardChart = useMemo(
    () => ({
      labels: wardStats.map((w) => w.name),
      datasets: [
        { label: t('common.total'), data: wardStats.map((w) => w.total), backgroundColor: GREEN },
        { label: t('status.resolved'), data: wardStats.map((w) => w.resolved), backgroundColor: DARK_GREEN },
      ],
    }),
    [wardStats, t]
  );

  const hint = t('admin.analytics.hint');
  const row = (name, total, resolved) =>
    t('admin.analytics.chartRow', { name, total: formatNumber(total), resolved: formatNumber(resolved) });
  const categoryChartLabel = t('admin.analytics.categoryChartLabel', {
    hint,
    items: categoryStats.map((c) => row(c.label, c.count, c.resolved)).join('; '),
  });
  const wardChartLabel = t('admin.analytics.wardChartLabel', {
    hint,
    items: wardStats.map((w) => row(w.name, w.total, w.resolved)).join('; '),
  });

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-3">
        <i className="fas fa-chart-bar me-2 text-success" aria-hidden="true"></i>
        {t('admin.analytics.title')}
      </h2>
      <div className="mb-2 text-body-secondary small">
        {t('admin.analytics.showing')}{' '}
        <span className="badge text-bg-secondary">{describeRangeText(t, formatDate, range.from, range.to)}</span>
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
        <LoadingState variant="cards" label={t('admin.analytics.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => refetch()} />
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col lg={6}>
              <ChartCard
                title={t('admin.analytics.byCategory')}
                empty={categoryStats.length === 0}
                label={categoryChartLabel}
                links={categoryStats.filter((c) => c.value).map((c) => ({ to: categoryHref(c), text: `${c.label} (${hint})` }))}
              >
                <Bar data={categoryChart} options={categoryOptions} role="img" aria-label={categoryChartLabel}>
                  {categoryChartLabel}
                </Bar>
              </ChartCard>
            </Col>
            <Col lg={6}>
              <ChartCard
                title={t('admin.analytics.byWard')}
                empty={wardStats.length === 0}
                label={wardChartLabel}
              >
                <Bar data={wardChart} options={wardOptions} role="img" aria-label={wardChartLabel}>
                  {wardChartLabel}
                </Bar>
              </ChartCard>
            </Col>
          </Row>

          <Row className="g-3">
            <Col>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-body-tertiary">
                  <Card.Title as="h3" className="mb-0 h5">{t('admin.analytics.officerPerformance')}</Card.Title>
                </Card.Header>
                <Card.Body>
                  {officers.length === 0 ? (
                    <p className="text-body-secondary text-center my-4" role="status">{t('admin.analytics.noOfficers')}</p>
                  ) : (
                    <>
                      <div className="table-responsive d-none d-md-block">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <caption className="visually-hidden">{t('admin.analytics.officerCaption')}</caption>
                          <thead>
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">{t('admin.analytics.officer')}</th>
                              <th scope="col" className="text-end">{t('common.total')}</th>
                              <th scope="col" className="text-end">{t('status.resolved')}</th>
                              <th scope="col" className="text-end">{t('admin.analytics.active')}</th>
                              <th scope="col" className="text-end">{t('admin.analytics.avgHours')}</th>
                              <th scope="col" className="text-end">{t('common.resolutionRate')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {officers.map((o, idx) => (
                              <tr key={o.id ?? idx}>
                                <td>{idx + 1}</td>
                                <td className="fw-bold">{nameLink(o, officerHref(o))}</td>
                                <td className="text-end">{formatNumber(o.total)}</td>
                                <td className="text-end">{formatNumber(o.resolved)}</td>
                                <td className="text-end">{formatNumber(o.active)}</td>
                                <td className="text-end">{o.avgHours == null ? '-' : o.avgHours.toFixed(1)}</td>
                                <td className="text-end">
                                  <RateBadge rate={o.rate} total={o.total} text={`${o.rate.toFixed(1)}%`} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ol className="list-unstyled d-md-none mb-0 d-grid gap-2" aria-label={t('admin.analytics.officerCaption')}>
                        {officers.map((o, idx) => (
                          <li key={o.id ?? idx} className="border rounded p-3">
                            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                              <span className="fw-bold text-break">
                                {idx + 1}. {nameLink(o, officerHref(o))}
                              </span>
                              <RateBadge rate={o.rate} total={o.total} text={`${o.rate.toFixed(1)}%`} />
                            </div>
                            <dl className="row mb-0 small g-1">
                              <dt className="col-8 fw-normal text-body-secondary">{t('common.total')}</dt>
                              <dd className="col-4 text-end mb-0">{formatNumber(o.total)}</dd>
                              <dt className="col-8 fw-normal text-body-secondary">{t('status.resolved')}</dt>
                              <dd className="col-4 text-end mb-0">{formatNumber(o.resolved)}</dd>
                              <dt className="col-8 fw-normal text-body-secondary">{t('admin.analytics.active')}</dt>
                              <dd className="col-4 text-end mb-0">{formatNumber(o.active)}</dd>
                              <dt className="col-8 fw-normal text-body-secondary">{t('admin.analytics.avgHours')}</dt>
                              <dd className="col-4 text-end mb-0">{o.avgHours == null ? '-' : o.avgHours.toFixed(1)}</dd>
                            </dl>
                          </li>
                        ))}
                      </ol>
                    </>
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
                    <Card.Title as="h3" className="mb-0 h5">{t('admin.analytics.wardDetails')}</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive d-none d-md-block">
                      <table className="table table-sm align-middle mb-0">
                        <caption className="visually-hidden">{t('admin.analytics.wardDetails')}</caption>
                        <thead>
                          <tr>
                            <th scope="col">{t('admin.analytics.ward')}</th>
                            <th scope="col" className="text-end">{t('common.total')}</th>
                            <th scope="col" className="text-end">{t('status.resolved')}</th>
                            <th scope="col" className="text-end">{t('admin.analytics.officers')}</th>
                            <th scope="col" className="text-end">{t('admin.analytics.rate')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wardStats.map((w, idx) => (
                            <tr key={w.id ?? idx}>
                              <td className="fw-bold">{nameLink(w, w.id != null ? wardHref(w) : null)}</td>
                              <td className="text-end">{formatNumber(w.total)}</td>
                              <td className="text-end">{formatNumber(w.resolved)}</td>
                              <td className="text-end">{formatNumber(w.officers)}</td>
                              <td className="text-end">
                                <RateBadge rate={pct(w.resolved, w.total)} total={w.total} text={`${pct(w.resolved, w.total)}%`} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="list-unstyled d-md-none mb-0 d-grid gap-2" aria-label={t('admin.analytics.wardDetails')}>
                      {wardStats.map((w, idx) => (
                        <li key={w.id ?? idx} className="border rounded p-3">
                          <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                            <span className="fw-bold text-break">{nameLink(w, w.id != null ? wardHref(w) : null)}</span>
                            <RateBadge rate={pct(w.resolved, w.total)} total={w.total} text={`${pct(w.resolved, w.total)}%`} />
                          </div>
                          <dl className="row mb-0 small g-1">
                            <dt className="col-8 fw-normal text-body-secondary">{t('common.total')}</dt>
                            <dd className="col-4 text-end mb-0">{formatNumber(w.total)}</dd>
                            <dt className="col-8 fw-normal text-body-secondary">{t('status.resolved')}</dt>
                            <dd className="col-4 text-end mb-0">{formatNumber(w.resolved)}</dd>
                            <dt className="col-8 fw-normal text-body-secondary">{t('admin.analytics.officers')}</dt>
                            <dd className="col-4 text-end mb-0">{formatNumber(w.officers)}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
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
