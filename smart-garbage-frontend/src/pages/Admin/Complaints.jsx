// src/pages/Admin/Complaints.jsx
import React, { useCallback, useMemo, useState } from 'react';
import { Container, Card, Table, Spinner, Badge, Button, Modal, Form, Row, Col, InputGroup, Pagination } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import apiClient from '../../services/api';
import { complaintKeys, useActiveOfficers, useAssignComplaint } from '../../hooks/useComplaints';
import { useWards } from '../../hooks/useWards';
import useDateRange, { describeRange } from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import StatusBadge from '../../components/common/StatusBadge';
import toast from 'react-hot-toast';
import { formatComplaintCategory, COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';

const PAGE_SIZE = 15;
const STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];
const URGENCY_VARIANTS = { critical: 'danger', high: 'danger', medium: 'warning', low: 'secondary' };

const statusLabel = (s) => (s ? s.replace(/_/g, ' ') : 'unknown');

function AdminComplaints() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = useDateRange();
  // Filters may be preset from the URL (e.g. links from Analytics): ?category=&ward=&officer=&status=
  const [wardFilter, setWardFilter] = useState(() => searchParams.get('ward') || '');
  const [officerFilter, setOfficerFilter] = useState(() => searchParams.get('officer') || '');
  const listParams = useMemo(
    () => ({ ...(wardFilter ? { ward_id: wardFilter } : {}), ...range.params }),
    [wardFilter, range.params]
  );
  const { data: complaintsData, isLoading } = useQuery(
    [...complaintKeys.admin, listParams],
    async () => (await apiClient.get('/admin/complaints', { params: listParams })).data?.data || [],
    { onError: () => toast.error('Failed to load complaints'), keepPreviousData: true }
  );
  const { data: wardsData } = useWards();
  const { data: officersData } = useActiveOfficers();
  const assignComplaint = useAssignComplaint();
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
      if (!id) return 'Unassigned';
      const o = officers.find((x) => String(x.officer_id) === String(id));
      return o ? o.name : 'Unassigned';
    },
    [officers]
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
      toast.error('Please select an officer');
      return;
    }
    setSubmitting(true);
    try {
      await assignComplaint.mutateAsync({ complaintId: target.complaint_id, officerId });
      toast.success(`Complaint #${target.complaint_id} assigned`);
      setTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign complaint');
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
  const activeChips = [];
  if (categoryFilter !== 'all') {
    activeChips.push({
      key: 'category',
      label: `Category: ${formatComplaintCategory(categoryFilter)}`,
      remove: () => {
        setCategoryFilter('all');
        dropParam('category');
      },
    });
  }
  if (wardFilter) {
    activeChips.push({
      key: 'ward',
      label: `Ward: ${wardName || `#${wardFilter}`}`,
      remove: () => {
        setWardFilter('');
        dropParam('ward');
      },
    });
  }
  if (officerFilter) {
    activeChips.push({
      key: 'officer',
      label: `Officer: ${officerName(officerFilter) !== 'Unassigned' ? officerName(officerFilter) : `#${officerFilter}`}`,
      remove: () => {
        setOfficerFilter('');
        dropParam('officer');
      },
    });
  }
  if (statusFilter !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Status: ${statusLabel(statusFilter)}`,
      remove: () => {
        setStatusFilter('all');
        dropParam('status');
      },
    });
  }
  if (range.from || range.to) {
    activeChips.push({ key: 'dates', label: `Dates: ${describeRange(range.from, range.to)}`, remove: range.clear });
  }

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-list me-2 text-success"></i>
        All Complaints
      </h2>

      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter by status">
        {chips.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'success' : 'outline-secondary'}
            className="text-capitalize"
            aria-pressed={statusFilter === s}
            onClick={() => {
              setStatusFilter(s);
              dropParam('status');
              setPage(1);
            }}
          >
            {s === 'all' ? 'All' : statusLabel(s)} <Badge bg="light" text="dark">{counts[s]}</Badge>
          </Button>
        ))}
      </div>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={4}>
              <Form.Select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  dropParam('category');
                  setPage(1);
                }}
              >
                <option value="all">All categories</option>
                {COMPLAINT_CATEGORIES.map((c) => {
                  const value = typeof c === 'string' ? c : c.value;
                  return (
                    <option key={value} value={value}>
                      {formatComplaintCategory(value)}
                    </option>
                  );
                })}
              </Form.Select>
            </Col>
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="fas fa-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="search"
                  aria-label="Search complaints by ID, area or citizen"
                  placeholder="Search by ID, area or citizen"
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
            <div className="d-flex flex-wrap gap-2 mt-3" aria-label="Active filters" data-testid="filter-chips">
              {activeChips.map((c) => (
                <Button
                  key={c.key}
                  size="sm"
                  variant="outline-success"
                  className="rounded-pill"
                  onClick={c.remove}
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label} <span aria-hidden="true">&times;</span>
                </Button>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        {isLoading ? (
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="success" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </Card.Body>
        ) : filtered.length === 0 ? (
          <Card.Body className="text-center py-5">
            <i className="fas fa-inbox fa-2x text-muted mb-2 d-block"></i>
            <p className="text-muted mb-0">No complaints found</p>
          </Card.Body>
        ) : (
          <>
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle">
                <thead className="table-success">
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Urgency</th>
                    <th>Citizen</th>
                    <th>Area</th>
                    <th>Officer</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr key={c.complaint_id}>
                      <td className="fw-bold">#{c.complaint_id}</td>
                      <td>{c.title}</td>
                      <td className="text-capitalize">{formatComplaintCategory(c.category)}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        {c.urgency_level ? (
                          <Badge bg={URGENCY_VARIANTS[String(c.urgency_level).toLowerCase()] || 'secondary'} className="text-capitalize">
                            {c.urgency_level}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{c.citizen_name || '-'}</td>
                      <td>{c.area || '-'}</td>
                      <td>{officerName(c.assigned_officer_id)}</td>
                      <td className="small text-muted">{c.created_at ? new Date(c.created_at).toLocaleString() : '-'}</td>
                      <td>
                        <Button
                          size="sm"
                          variant={c.assigned_officer_id ? 'outline-primary' : 'success'}
                          disabled={submitting}
                          onClick={() => openAssign(c)}
                          aria-label={`${c.assigned_officer_id ? 'Reassign' : 'Assign'} complaint ${c.complaint_id}`}
                        >
                          {c.assigned_officer_id ? 'Reassign' : 'Assign'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Card.Footer className="bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2">
              <small className="text-muted">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </small>
              <Pagination size="sm" className="mb-0">
                <Pagination.Prev disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} />
                <Pagination.Item active>
                  {currentPage} / {totalPages}
                </Pagination.Item>
                <Pagination.Next disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} />
              </Pagination>
            </Card.Footer>
          </>
        )}
      </Card>

      <Modal show={!!target} onHide={closeAssign} centered>
        <Form onSubmit={handleAssign}>
          <Modal.Header closeButton={!submitting}>
            <Modal.Title>
              {target?.assigned_officer_id ? 'Reassign' : 'Assign'} Complaint #{target?.complaint_id}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {target && <p className="text-muted">{target.title}</p>}
            <Form.Group controlId="assign-officer">
              <Form.Label>Officer</Form.Label>
              <Form.Select
                aria-label="Select officer"
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                disabled={submitting}
              >
                <option value="">Select an officer...</option>
                {officers.map((o) => (
                  <option key={o.officer_id} value={o.officer_id}>
                    {o.name} - {o.ward_name || 'No ward'} ({o.active_complaints ?? 0} active)
                  </option>
                ))}
              </Form.Select>
              {officers.length === 0 && <Form.Text className="text-muted">No active officers available.</Form.Text>}
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={closeAssign} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={submitting || !officerId}>
              {submitting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default AdminComplaints;
