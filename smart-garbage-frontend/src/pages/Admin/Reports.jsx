// src/pages/Admin/Reports.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Spinner, ProgressBar } from 'react-bootstrap';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';
import useDateRange from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import { statusLabel, categoryLabel } from '../../i18n/labels';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';

const STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];
const EMPTY_FILTERS = { status: '', category: '', ward_id: '' };
const TAP = { minHeight: 44 };

const buildParams = (filters) => {
  const params = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params[k] = v;
  });
  return params;
};

const countBy = (rows, getter) => {
  const map = {};
  rows.forEach((r) => {
    const key = getter(r) || 'unknown';
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
};

function Breakdown({ title, entries, total, formatLabel, noData, barLabel, formatNumber }) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Header as="h3" className="bg-body-tertiary fw-semibold h6 mb-0">
        {title}
      </Card.Header>
      <Card.Body>
        {entries.length === 0 ? (
          <p className="text-body-secondary mb-0">{noData}</p>
        ) : (
          entries.map(([key, count]) => {
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={key} className="mb-2">
                <div className="d-flex justify-content-between gap-2 small">
                  <span className="text-break text-capitalize">{formatLabel(key)}</span>
                  <span className="text-body-secondary flex-shrink-0">
                    {formatNumber(count)} ({pct}%)
                  </span>
                </div>
                <ProgressBar
                  now={pct}
                  variant="success"
                  style={{ height: 8 }}
                  aria-label={barLabel(formatLabel(key), pct)}
                />
              </div>
            );
          })
        )}
      </Card.Body>
    </Card>
  );
}

function AdminReports() {
  const { t, formatDate, formatNumber } = useTranslation();
  const [selects, setSelects] = useState(EMPTY_FILTERS);
  const range = useDateRange();
  const filters = useMemo(() => ({ ...selects, ...range.params }), [selects, range.params]);
  const [wards, setWards] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // The hook's message is English; show the translated one instead.
  const dateError = range.error ? t('admin.reports.dateOrderError') : '';
  const hasDateError = !!range.error;

  useEffect(() => {
    let active = true;
    apiClient
      .get('/wards')
      .then((res) => active && setWards(res.data?.data || []))
      .catch(() => active && toast.error(t('admin.reports.wardsError')));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasDateError) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get('/admin/complaints', { params: buildParams(filters) });
        if (active) setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        if (active) {
          setRows([]);
          setError(t('admin.reports.loadError'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, hasDateError, retryKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelects((prev) => ({ ...prev, [name]: value }));
  };

  const sLabel = (v) => statusLabel(t, v);
  const cLabel = (v) => categoryLabel(t, v);
  const byStatus = useMemo(() => countBy(rows, (r) => r.status), [rows]);
  const byCategory = useMemo(() => countBy(rows, (r) => r.category), [rows]);

  const handleExportCSV = async () => {
    if (dateError) {
      toast.error(dateError);
      return;
    }
    setExporting(true);
    setExportStatus(t('admin.reports.exporting'));
    let url;
    let link;
    try {
      const response = await apiClient.get('/admin/report/export', {
        params: buildParams(filters),
        responseType: 'blob',
      });
      url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      link = document.createElement('a');
      link.href = url;
      link.download = `complaints-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      toast.success(t('admin.reports.exportSuccess'));
      setExportStatus(t('admin.reports.exportSuccess'));
    } catch (err) {
      toast.error(t('admin.reports.exportError'));
      setExportStatus(t('admin.reports.exportError'));
    } finally {
      if (link && link.parentNode) link.parentNode.removeChild(link);
      if (url) window.URL.revokeObjectURL(url);
      setExporting(false);
    }
  };

  const preview = rows.slice(0, 10);
  const barLabel = (label, pct) => t('admin.reports.barLabel', { label, percent: pct });

  return (
    <Container className="py-4">
      <style>{`
        .reports-page .btn { min-height: 44px; }
        .reports-page .form-control, .reports-page .form-select { min-height: 44px; }
        @media (max-width: 575.98px) { .reports-page .reports-actions .btn { flex: 1 1 100%; } }
        @media print {
          .d-print-none { display: none !important; }
          .reports-page .card { box-shadow: none !important; border: 1px solid #999 !important; break-inside: avoid; }
        }
      `}</style>
      <div className="reports-page">
        <PageHeader
          icon="file-csv"
          title={t('admin.reports.title')}
          subtitle={t('admin.reports.subtitle')}
          actions={
            <div className="reports-actions d-flex flex-wrap gap-2 mt-2 mt-md-0 d-print-none">
              <Button variant="success" onClick={handleExportCSV} disabled={exporting || !!dateError}>
                {exporting ? (
                  <Spinner as="span" animation="border" size="sm" className="me-2" aria-hidden="true" />
                ) : (
                  <i className="fas fa-download me-2" aria-hidden="true"></i>
                )}
                {exporting ? t('admin.reports.exporting') : t('admin.reports.exportCsv')}
              </Button>
              <Button variant="outline-secondary" onClick={() => window.print()}>
                <i className="fas fa-print me-2" aria-hidden="true"></i>
                {t('admin.reports.print')}
              </Button>
            </div>
          }
        />
        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {exportStatus}
        </div>

        <Card className="border-0 shadow-sm mb-4 d-print-none">
          <Card.Body>
            <h3 className="h6 fw-semibold mb-3">{t('admin.reports.filters')}</h3>
            <Form onSubmit={(e) => e.preventDefault()} noValidate aria-label={t('admin.reports.filters')}>
              <Row className="g-3">
                <Col xs={12} sm={6} lg={3}>
                  <Form.Group controlId="report-status">
                    <Form.Label>{t('admin.reports.status')}</Form.Label>
                    <Form.Select name="status" value={filters.status} onChange={handleChange}>
                      <option value="">{t('admin.reports.allStatuses')}</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}`)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Form.Group controlId="report-category">
                    <Form.Label>{t('admin.reports.category')}</Form.Label>
                    <Form.Select name="category" value={filters.category} onChange={handleChange}>
                      <option value="">{t('admin.reports.allCategories')}</option>
                      {COMPLAINT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {cLabel(c.value)}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Form.Group controlId="report-ward">
                    <Form.Label>{t('admin.reports.ward')}</Form.Label>
                    <Form.Select name="ward_id" value={filters.ward_id} onChange={handleChange}>
                      <option value="">{t('admin.reports.allWards')}</option>
                      {wards.map((w) => (
                        <option key={w.ward_id} value={w.ward_id}>
                          {w.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6} lg={3} className="d-flex align-items-end">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    className="w-100"
                    style={TAP}
                    onClick={() => {
                      setSelects(EMPTY_FILTERS);
                      range.clear();
                    }}
                  >
                    <i className="fas fa-undo me-2" aria-hidden="true"></i>
                    {t('admin.reports.reset')}
                  </Button>
                </Col>
              </Row>
              <div className="mt-3">
                <DateRangeFilter
                  idPrefix="report-range"
                  from={range.from}
                  to={range.to}
                  setRange={range.setRange}
                  clear={range.clear}
                />
                {dateError && (
                  <div className="text-danger-emphasis small mt-1" role="alert">
                    {dateError}
                  </div>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>

        {error && <ErrorState message={error} onRetry={() => setRetryKey((k) => k + 1)} />}

        <div aria-busy={loading}>
          {loading ? (
            <LoadingState variant="cards" label={t('admin.reports.loading')} />
          ) : dateError || error ? null : rows.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <EmptyState icon="inbox" title={t('admin.reports.emptyTitle')} text={t('admin.reports.empty')} />
              </Card.Body>
            </Card>
          ) : (
            <>
              <Row className="g-3 mb-4">
                <Col xs={12} md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <Card.Body className="text-center">
                      <h3 className="h6 text-body-secondary fw-normal">{t('admin.reports.totalMatched')}</h3>
                      <div className="display-5 fw-bold text-success-emphasis">{formatNumber(rows.length)}</div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={4}>
                  <Breakdown
                    title={t('admin.reports.byStatus')}
                    entries={byStatus}
                    total={rows.length}
                    formatLabel={sLabel}
                    noData={t('admin.reports.noData')}
                    barLabel={barLabel}
                    formatNumber={formatNumber}
                  />
                </Col>
                <Col xs={12} md={4}>
                  <Breakdown
                    title={t('admin.reports.byCategory')}
                    entries={byCategory}
                    total={rows.length}
                    formatLabel={cLabel}
                    noData={t('admin.reports.noData')}
                    barLabel={barLabel}
                    formatNumber={formatNumber}
                  />
                </Col>
              </Row>

              <Card className="border-0 shadow-sm">
                <Card.Header as="h3" className="bg-body-tertiary fw-semibold h6 mb-0">
                  {t('admin.reports.preview', { shown: formatNumber(preview.length), total: formatNumber(rows.length) })}
                </Card.Header>
                <Table responsive hover className="mb-0 align-middle">
                  <caption className="visually-hidden">{t('admin.reports.tableCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.reports.colId')}</th>
                      <th scope="col">{t('admin.reports.colTitle')}</th>
                      <th scope="col">{t('admin.reports.colCategory')}</th>
                      <th scope="col">{t('admin.reports.colStatus')}</th>
                      <th scope="col">{t('admin.reports.colCreated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={r.complaint_id || r.id || i}>
                        <td>{r.complaint_id || r.id || '-'}</td>
                        <td className="text-break" style={{ minWidth: 160 }}>
                          {r.title || r.description || '-'}
                        </td>
                        <td>{cLabel(r.category)}</td>
                        <td>
                          <StatusBadge status={r.status} className="text-capitalize" />
                        </td>
                        <td className="text-nowrap">{r.created_at ? formatDate(r.created_at) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}

export default AdminReports;
