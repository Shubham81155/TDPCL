// src/pages/Admin/Complaints.jsx
import React, { useCallback, useMemo, useState } from 'react';
import { Container, Card, Table, Spinner, Badge, Button, Modal, Form, Row, Col, InputGroup } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import apiClient from '../../services/api';
import { complaintKeys, useActiveOfficers, useAssignComplaint, useInvalidateComplaintData } from '../../hooks/useComplaints';
import { useWards } from '../../hooks/useWards';
import useDateRange from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { useTranslation } from '../../i18n/LanguageContext';
import { statusLabel, categoryLabel, urgencyLabel } from '../../i18n/labels';
import toast from 'react-hot-toast';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';

const PAGE_SIZE = 15;
const STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];
const URGENCY_VARIANTS = { critical: 'danger', high: 'danger', medium: 'warning', low: 'secondary' };

const TAP = { minHeight: 44 };

function AdminComplaints() {
  const { t, formatDate, formatDateTime } = useTranslation();
  const tt = (k, p) => t(`admin.complaints.${k}`, p);
  const [searchParams, setSearchParams] = useSearchParams();
  const range = useDateRange();
  // Filters may be preset from the URL (e.g. links from Analytics): ?category=&ward=&officer=&status=
  const [wardFilter, setWardFilter] = useState(() => searchParams.get('ward') || '');
  const [officerFilter, setOfficerFilter] = useState(() => searchParams.get('officer') || '');
  const listParams = useMemo(
    () => ({ ...(wardFilter ? { ward_id: wardFilter } : {}), ...range.params }),
    [wardFilter, range.params]
  );
  const { data: complaintsData, isLoading, isError, refetch } = useQuery(
    [...complaintKeys.admin, listParams],
    async () => (await apiClient.get('/admin/complaints', { params: listParams })).data?.data || [],
    { onError: () => toast.error(tt('loadFailed')), keepPreviousData: true }
  );
  const { data: wardsData } = useWards();
  const { data: officersData } = useActiveOfficers();
  const assignComplaint = useAssignComplaint();
  const invalidateComplaintData = useInvalidateComplaintData();
  const [autoAssigning, setAutoAssigning] = useState(false);
  const complaints = useMemo(() => complaintsData || [], [complaintsData]);
  const officers = useMemo(() => officersData || [], [officersData]);
  const [statusFilter, setStatusFilter] = useState(() => {
    const v = searchParams.get('status');
    return STATUSES.includes(v) ? v : 'all';
  });
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || 'all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [target, setTarget] = useState(null);
  const [officerId, setOfficerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const officerName = useCallback(
    (id) => {
      if (!id) return tt('unassigned');
      const o = officers.find((x) => String(x.officer_id) === String(id));
      return o ? o.name : tt('unassigned');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officers, t]
  );

  // Ward/officer scoped list (status chip counts reflect these filters)
  const scoped = useMemo(
    () =>
      officerFilter
        ? complaints.filter((x) => String(x.assigned_officer_id) === String(officerFilter))
        : complaints,
    [complaints, officerFilter]
  );

  const counts = useMemo(() => {
    const c = { all: scoped.length };
    STATUSES.forEach((s) => {
      c[s] = 0;
    });
    scoped.forEach((x) => {
      if (c[x.status] !== undefined) c[x.status] += 1;
    });
    return c;
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .filter((c) => categoryFilter === 'all' || c.category === categoryFilter)
      .filter((c) => {
        if (!q) return true;
        return [c.complaint_id, c.area, c.citizen_name].some((v) =>
          String(v ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [scoped, statusFilter, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openAssign = (complaint) => {
    setTarget(complaint);
    setOfficerId(complaint.assigned_officer_id ? String(complaint.assigned_officer_id) : '');
  };

  const closeAssign = () => {
    if (!submitting) setTarget(null);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!officerId || !target) {
      toast.error(tt('selectOfficerToast'));
      return;
    }
    setSubmitting(true);
    try {
      await assignComplaint.mutateAsync({ complaintId: target.complaint_id, officerId });
      toast.success(tt('assigned', { id: target.complaint_id }));
      setTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || tt('assignFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const chips = ['all', ...STATUSES];

  const dropParam = (...keys) => {
    const next = new URLSearchParams(searchParams);
    keys.forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const wardName = (wardsData || []).find((w) => String(w.ward_id) === String(wardFilter))?.name;
  let rangeText = '';
  if (range.from && range.to) rangeText = `${formatDate(range.from)} - ${formatDate(range.to)}`;
  else if (range.from) rangeText = tt('dateFrom', { date: formatDate(range.from) });
  else if (range.to) rangeText = tt('dateTo', { date: formatDate(range.to) });
  const activeChips = [];
  if (categoryFilter !== 'all') {
    activeChips.push({
      key: 'category',
      label: tt('chipCategory', { value: categoryLabel(t, categoryFilter) }),
      remove: () => {
        setCategoryFilter('all');
        dropParam('category');
      },
    });
  }
  if (wardFilter) {
    activeChips.push({
      key: 'ward',
      label: tt('chipWard', { value: wardName || `#${wardFilter}` }),
      remove: () => {
        setWardFilter('');
        dropParam('ward');
      },
    });
  }
  if (officerFilter) {
    activeChips.push({
      key: 'officer',
      label: tt('chipOfficer', { value: officerName(officerFilter) !== tt('unassigned') ? officerName(officerFilter) : `#${officerFilter}` }),
      remove: () => {
        setOfficerFilter('');
        dropParam('officer');
      },
    });
  }
  if (statusFilter !== 'all') {
    activeChips.push({
      key: 'status',
      label: tt('chipStatus', { value: statusLabel(t, statusFilter) }),
      remove: () => {
        setStatusFilter('all');
        dropParam('status');
      },
    });
  }
  if (range.from || range.to) {
    activeChips.push({ key: 'dates', label: tt('chipDates', { value: rangeText }), remove: range.clear });
  }

  const waitingCount = complaints.filter((c) => c.status === 'new').length;

  const runAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      const { data } = await apiClient.post('/assignments/auto-assign-unassigned');
      if (data.assigned > 0) {
        toast.success(tt('autoAssignDone', { assigned: data.assigned, remaining: data.remaining }));
      } else {
        toast(tt('autoAssignNone'));
      }
      await invalidateComplaintData();
    } catch (error) {
      toast.error(error.response?.data?.error || tt('autoAssignFailed'));
    } finally {
      setAutoAssigning(false);
    }
  };

  const from = (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <Container className="py-3 py-md-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 mb-md-4">
        <h1 className="h2 fw-bold mb-0">
          <i className="fas fa-list me-2 text-success" aria-hidden="true"></i>
          {tt('title')}
        </h1>
        {waitingCount > 0 && (
          <Button variant="outline-success" style={TAP} onClick={runAutoAssign} disabled={autoAssigning}>
            <i className="fas fa-wand-magic-sparkles me-2" aria-hidden="true"></i>
            {autoAssigning ? tt('autoAssigning') : tt('autoAssignWaiting', { count: waitingCount })}
          </Button>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label={tt('filterByStatus')}>
        {chips.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'success' : 'outline-secondary'}
            className="text-capitalize d-inline-flex align-items-center gap-1"
            style={TAP}
            aria-pressed={statusFilter === s}
            onClick={() => {
              setStatusFilter(s);
              dropParam('status');
              setPage(1);
            }}
          >
            {s === 'all' ? tt('all') : statusLabel(t, s)}{' '}
            <Badge bg="" className="bg-body-secondary text-body border">
              {counts[s]}
            </Badge>
          </Button>
        ))}
      </div>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col xs={12} md={4}>
              <Form.Select
                aria-label={tt('filterByCategory')}
                style={TAP}
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  dropParam('category');
                  setPage(1);
                }}
              >
                <option value="all">{tt('allCategories')}</option>
                {COMPLAINT_CATEGORIES.map((c) => {
                  const value = typeof c === 'string' ? c : c.value;
                  return (
                    <option key={value} value={value}>
                      {categoryLabel(t, value)}
                    </option>
                  );
                })}
              </Form.Select>
            </Col>
            <Col xs={12} md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="fas fa-search" aria-hidden="true"></i>
                </InputGroup.Text>
                <Form.Control
                  type="search"
                  style={TAP}
                  aria-label={tt('searchLabel')}
                  placeholder={tt('searchPlaceholder')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </InputGroup>
            </Col>
          </Row>
          <div className="mt-3">
            <DateRangeFilter
              idPrefix="complaints-range"
              from={range.from}
              to={range.to}
              setRange={range.setRange}
              clear={range.clear}
            />
          </div>
          {activeChips.length > 0 && (
            <div
              className="d-flex flex-wrap gap-2 mt-3"
              role="group"
              aria-label={tt('activeFilters')}
              data-testid="filter-chips"
            >
              {activeChips.map((c) => (
                <Button
                  key={c.key}
                  size="sm"
                  variant="outline-success"
                  className="rounded-pill text-start"
                  style={TAP}
                  onClick={c.remove}
                  aria-label={tt('removeFilter', { label: c.label })}
                >
                  {c.label} <span aria-hidden="true">&times;</span>
                </Button>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {isError && !complaintsData ? (
        <ErrorState message={tt('loadFailed')} onRetry={() => refetch()} />
      ) : (
        <Card className="border-0 shadow-sm">
          {isLoading ? (
            <Card.Body>
              <LoadingState variant="table" label={tt('loading')} />
            </Card.Body>
          ) : filtered.length === 0 ? (
            <Card.Body>
              <EmptyState icon="inbox" title={tt('empty')} text={tt('emptyHint')} className="py-4" />
            </Card.Body>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <caption className="visually-hidden">{tt('tableCaption')}</caption>
                  <thead className="table-success">
                    <tr>
                      <th scope="col">{tt('colId')}</th>
                      <th scope="col">{tt('colTitle')}</th>
                      <th scope="col" className="d-none d-lg-table-cell">{tt('colCategory')}</th>
                      <th scope="col">{tt('colStatus')}</th>
                      <th scope="col" className="d-none d-md-table-cell">{tt('colUrgency')}</th>
                      <th scope="col" className="d-none d-xl-table-cell">{tt('colCitizen')}</th>
                      <th scope="col" className="d-none d-lg-table-cell">{tt('colArea')}</th>
                      <th scope="col" className="d-none d-md-table-cell">{tt('colOfficer')}</th>
                      <th scope="col" className="d-none d-xl-table-cell">{tt('colCreated')}</th>
                      <th scope="col">{tt('colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => (
                      <tr key={c.complaint_id}>
                        <td className="fw-bold">#{c.complaint_id}</td>
                        <td>
                          <div>{c.title}</div>
                          {/* Columns hidden on narrow screens are summarised here */}
                          <div className="small text-body-secondary d-lg-none">
                            {categoryLabel(t, c.category)}
                            {c.area ? ` · ${c.area}` : ''}
                          </div>
                          <div className="small text-body-secondary d-md-none">
                            {officerName(c.assigned_officer_id)}
                          </div>
                        </td>
                        <td className="text-capitalize d-none d-lg-table-cell">{categoryLabel(t, c.category)}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="d-none d-md-table-cell">
                          {c.urgency_level ? (
                            <Badge
                              bg={URGENCY_VARIANTS[String(c.urgency_level).toLowerCase()] || 'secondary'}
                              className="text-capitalize"
                            >
                              {urgencyLabel(t, c.urgency_level)}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="d-none d-xl-table-cell">{c.citizen_name || '-'}</td>
                        <td className="d-none d-lg-table-cell">{c.area || '-'}</td>
                        <td className="d-none d-md-table-cell">{officerName(c.assigned_officer_id)}</td>
                        <td className="small text-body-secondary d-none d-xl-table-cell">
                          {c.created_at ? formatDateTime(c.created_at) : '-'}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant={c.assigned_officer_id ? 'outline-primary' : 'success'}
                            style={{ ...TAP, minWidth: 44 }}
                            disabled={submitting}
                            onClick={() => openAssign(c)}
                            aria-label={tt(c.assigned_officer_id ? 'reassignAria' : 'assignAria', { id: c.complaint_id })}
                          >
                            {tt(c.assigned_officer_id ? 'reassign' : 'assign')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <Card.Footer className="bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2">
                <small className="text-body-secondary" role="status">
                  {tt('showing', { from, to, total: filtered.length })}
                </small>
                <nav aria-label={tt('pagination')} className="d-flex align-items-center gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    style={TAP}
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    {tt('prev')}
                  </Button>
                  <span className="small" aria-current="page">
                    {tt('pageOf', { page: currentPage, total: totalPages })}
                  </span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    style={TAP}
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    {tt('next')}
                  </Button>
                </nav>
              </Card.Footer>
            </>
          )}
        </Card>
      )}

      <Modal show={!!target} onHide={closeAssign} centered aria-labelledby="assign-modal-title">
        <Form onSubmit={handleAssign}>
          <Modal.Header closeButton={!submitting} closeLabel={tt('close')}>
            <Modal.Title as="h2" className="h5" id="assign-modal-title">
              {tt(target?.assigned_officer_id ? 'modalReassign' : 'modalAssign', { id: target?.complaint_id })}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {target && <p className="text-body-secondary">{target.title}</p>}
            <Form.Group controlId="assign-officer">
              <Form.Label>{tt('officer')}</Form.Label>
              <Form.Select
                aria-label={tt('selectOfficer')}
                style={TAP}
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                disabled={submitting}
              >
                <option value="">{tt('selectOfficerPlaceholder')}</option>
                {officers.map((o) => (
                  <option key={o.officer_id} value={o.officer_id}>
                    {tt('officerOption', {
                      name: o.name,
                      ward: o.ward_name || tt('noWard'),
                      count: o.active_complaints ?? 0,
                    })}
                  </option>
                ))}
              </Form.Select>
              {officers.length === 0 && (
                <Form.Text className="text-body-secondary" role="status">
                  {tt('noOfficers')}
                </Form.Text>
              )}
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" style={TAP} onClick={closeAssign} disabled={submitting}>
              {tt('cancel')}
            </Button>
            <Button type="submit" variant="success" style={TAP} disabled={submitting || !officerId}>
              {submitting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" aria-hidden="true" />
                  {tt('saving')}
                </>
              ) : (
                tt('confirm')
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default AdminComplaints;
