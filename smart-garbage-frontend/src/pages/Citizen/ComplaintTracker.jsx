// src/pages/Citizen/ComplaintTracker.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Pagination } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useMyComplaints } from '../../hooks/useComplaints';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge, { UrgencyBadge } from '../../components/common/StatusBadge';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import { categoryLabel } from '../../i18n/labels';

function ComplaintTracker() {
  const { t, formatDate } = useTranslation();
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading, isError, refetch } = useMyComplaints();

  const filteredComplaints = useMemo(
    () =>
      (data || [])
        .filter((c) => !filters.status || c.status === filters.status)
        .filter((c) => !filters.category || c.category === filters.category),
    [data, filters]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const paginatedComplaints = filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredComplaints.length / pageSize);

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-list me-2 text-success"></i>
            {t('nav.myComplaints')}
          </h2>
          <p className="text-muted">{t('citizen.tracker.subtitle')}</p>
        </Col>
        <Col md="auto">
          <Link to="/citizen/complaint/new">
            <Button variant="success">
              <i className="fas fa-plus me-2"></i>
              {t('common.reportNewIssue')}
            </Button>
          </Link>
        </Col>
      </Row>

      <Card className="border-0 shadow-lg mb-4">
        <Card.Body className="p-3">
          <Row>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="small fw-bold">{t('common.filterByStatus')}</Form.Label>
                <Form.Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  size="sm"
                >
                  <option value="">{t('common.allStatus')}</option>
                  <option value="new">{t('status.new')}</option>
                  <option value="assigned">{t('status.assigned')}</option>
                  <option value="in_progress">{t('status.in_progress')}</option>
                  <option value="resolved">{t('status.resolved')}</option>
                  <option value="rejected">{t('status.rejected')}</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="small fw-bold">{t('citizen.tracker.filterCategory')}</Form.Label>
                <Form.Select
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                  size="sm"
                >
                  <option value="">{t('citizen.tracker.allCategories')}</option>
                  {COMPLAINT_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {categoryLabel(t, option.value)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoading ? (
        <LoadingState variant="table" label={t('citizen.tracker.loading')} />
      ) : isError ? (
        <ErrorState message={t('common.loadFailed')} onRetry={refetch} />
      ) : filteredComplaints.length === 0 ? (
        <Card className="border-0 shadow-sm">
          {(data || []).length === 0 ? (
            <EmptyState
              icon="clipboard-list"
              title={t('citizen.tracker.emptyTitle')}
              text={t('citizen.tracker.emptyNone')}
              action={{ label: t('citizen.tracker.emptyNoneAction'), to: '/citizen/complaint/new', icon: 'plus' }}
            />
          ) : (
            <EmptyState
              icon="filter"
              title={t('citizen.tracker.emptyTitle')}
              text={t('citizen.tracker.emptyFiltered')}
              action={{ label: t('citizen.tracker.clearFilters'), onClick: () => setFilters({ status: '', category: '' }), variant: 'outline-secondary' }}
            />
          )}
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-lg">
            <Table responsive className="mb-0">
              <thead className="table-success">
                <tr>
                  <th>{t('common.id')}</th>
                  <th>{t('common.title')}</th>
                  <th className="d-none d-md-table-cell">{t('common.category')}</th>
                  <th className="d-none d-md-table-cell">{t('citizen.tracker.urgency')}</th>
                  <th>{t('common.status')}</th>
                  <th className="d-none d-md-table-cell">{t('citizen.tracker.submitted')}</th>
                  <th>{t('common.action')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id}>
                    <td className="fw-bold">#{complaint.complaint_id}</td>
                    <td>{complaint.title}</td>
                    <td className="d-none d-md-table-cell">{categoryLabel(t, complaint.category)}</td>
                    <td className="d-none d-md-table-cell"><UrgencyBadge urgency={complaint.urgency_level} /></td>
                    <td><StatusBadge status={complaint.status} /></td>
                    <td className="small text-muted d-none d-md-table-cell">
                      {formatDate(complaint.created_at)}
                    </td>
                    <td>
                      <Link to={`/citizen/complaint/${complaint.complaint_id}`}>
                        <Button variant="primary" size="sm">
                          {t('common.view')}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <Pagination className="justify-content-center mt-4">
              <Pagination.First
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              />
              <Pagination.Prev
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              />

              {[...Array(totalPages)].map((_, i) => (
                <Pagination.Item
                  key={i + 1}
                  active={i + 1 === currentPage}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}

              <Pagination.Next
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              />
              <Pagination.Last
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              />
            </Pagination>
          )}
        </>
      )}
    </Container>
  );
}

export default ComplaintTracker;
