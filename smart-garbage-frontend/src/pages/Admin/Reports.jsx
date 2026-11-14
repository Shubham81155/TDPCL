// src/pages/Admin/Reports.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Spinner, ProgressBar, Alert } from 'react-bootstrap';
import toast from 'react-hot-toast';
import apiClient from '../../services/api';
import useDateRange from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';

const STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];
const EMPTY_FILTERS = { status: '', category: '', ward_id: '' };

const labelize = (v) =>
  (v || 'unclassified')
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const categoryLabel = (v) => COMPLAINT_CATEGORIES.find((c) => c.value === v)?.label || labelize(v);

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

function Breakdown({ title, entries, total, formatLabel }) {
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Header className="bg-body-tertiary fw-semibold">{title}</Card.Header>
      <Card.Body>
        {entries.length === 0 ? (
          <p className="text-muted mb-0">No data</p>
        ) : (
          entries.map(([key, count]) => (
            <div key={key} className="mb-2">
              <div className="d-flex justify-content-between small">
                <span>{formatLabel(key)}</span>
                <span className="text-muted">
                  {count} ({total ? Math.round((count / total) * 100) : 0}%)
                </span>
              </div>
              <ProgressBar now={total ? (count / total) * 100 : 0} style={{ height: 6 }} aria-label={formatLabel(key)} />
            </div>
          ))
        )}
      </Card.Body>
    </Card>
  );
}

function AdminReports() {
  const [selects, setSelects] = useState(EMPTY_FILTERS);
  const range = useDateRange();
  const filters = useMemo(() => ({ ...selects, ...range.params }), [selects, range.params]);
  const [wards, setWards] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const dateError = range.error;

  useEffect(() => {
    let active = true;
    apiClient
      .get('/wards')
      .then((res) => active && setWards(res.data?.data || []))
      .catch(() => active && toast.error('Failed to load wards'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dateError) {
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
          setError('Failed to load report preview');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, dateError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelects((prev) => ({ ...prev, [name]: value }));
  };

  const byStatus = useMemo(() => countBy(rows, (r) => r.status), [rows]);
  const byCategory = useMemo(() => countBy(rows, (r) => r.category), [rows]);

  const handleExportCSV = async () => {
    if (dateError) {
      toast.error(dateError);
      return;
    }
    setExporting(true);
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
      toast.success('Report exported successfully');
    } catch (err) {
      toast.error('Failed to export report');
    } finally {
      if (link && link.parentNode) link.parentNode.removeChild(link);
      if (url) window.URL.revokeObjectURL(url);
      setExporting(false);
    }
  };

  const preview = rows.slice(0, 10);

  return (
    <Container className="py-4">
      <style>{`@media print { .d-print-none { display: none !important; } }`}</style>

      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <h2 className="fw-bold mb-0">
          <i className="fas fa-file-csv me-2 text-success"></i>
          Reports & Export
        </h2>
        <div className="d-flex flex-wrap gap-2 d-print-none">
          <Button variant="success" onClick={handleExportCSV} disabled={exporting || !!dateError}>
            {exporting ? (
              <Spinner as="span" animation="border" size="sm" className="me-2" />
            ) : (
              <i className="fas fa-download me-2"></i>
            )}
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button variant="outline-secondary" onClick={() => window.print()}>
            <i className="fas fa-print me-2"></i>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-4 d-print-none">
        <Card.Body>
          <Form onSubmit={(e) => e.preventDefault()} noValidate>
            <Row className="g-3">
              <Col xs={12} sm={6} lg={3}>
                <Form.Group controlId="report-status">
                  <Form.Label>Status</Form.Label>
                  <Form.Select name="status" value={filters.status} onChange={handleChange}>
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {labelize(s)}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <Form.Group controlId="report-category">
                  <Form.Label>Category</Form.Label>
                  <Form.Select name="category" value={filters.category} onChange={handleChange}>
                    <option value="">All categories</option>
                    {COMPLAINT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <Form.Group controlId="report-ward">
                  <Form.Label>Ward</Form.Label>
                  <Form.Select name="ward_id" value={filters.ward_id} onChange={handleChange}>
                    <option value="">All wards</option>
                    {wards.map((w) => (
                      <option key={w.ward_id} value={w.ward_id}>
                        {w.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} sm={6} lg={3} className="d-flex align-items-end">
                <Button variant="outline-secondary" className="w-100" onClick={() => {
                    setSelects(EMPTY_FILTERS);
                    range.clear();
                  }}
                >
                  Reset
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
                <div className="text-danger small mt-1" role="alert">
                  {dateError}
                </div>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5" role="status">
          <Spinner animation="border" variant="success" />
          <div className="text-muted mt-2">Loading preview...</div>
        </div>
      ) : dateError ? null : rows.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center text-muted py-5">
            <i className="fas fa-inbox fa-2x mb-2"></i>
            <div>No complaints match the selected filters.</div>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col xs={12} md={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="text-center">
                  <div className="text-muted">Total matched</div>
                  <div className="display-5 fw-bold text-success">{rows.length}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} md={4}>
              <Breakdown title="By status" entries={byStatus} total={rows.length} formatLabel={labelize} />
            </Col>
            <Col xs={12} md={4}>
              <Breakdown title="By category" entries={byCategory} total={rows.length} formatLabel={categoryLabel} />
            </Col>
          </Row>

          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-body-tertiary fw-semibold">
              Preview (first {preview.length} of {rows.length})
            </Card.Header>
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={r.complaint_id || r.id || i}>
                    <td>{r.complaint_id || r.id || '-'}</td>
                    <td>{r.title || r.description || '-'}</td>
                    <td>{categoryLabel(r.category)}</td>
                    <td>
                      <span className={`badge status-${r.status}`}>{labelize(r.status)}</span>
                    </td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </Container>
  );
}

export default AdminReports;
