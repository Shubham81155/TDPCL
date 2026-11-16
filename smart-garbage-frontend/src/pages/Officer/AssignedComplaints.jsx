// src/pages/Officer/AssignedComplaints.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Modal, Pagination } from 'react-bootstrap';
import { useAssignedComplaints, useUpdateComplaintStatus } from '../../hooks/useComplaints';
import toast from 'react-hot-toast';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import { useTranslation } from '../../i18n/LanguageContext';
import { categoryLabel } from '../../i18n/labels';

function AssignedComplaints() {
  const { t, formatDate } = useTranslation();
  const [filters, setFilters] = useState({ status: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const pageSize = 10;
  const { data, isLoading, isError, refetch } = useAssignedComplaints({
    onError: () => toast.error(t('officer.assigned.loadFailed')),
  });
  const updateStatus = useUpdateComplaintStatus();

  const filteredComplaints = useMemo(
    () => (data || []).filter((c) => !filters.status || c.status === filters.status),
    [data, filters]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdate) {
      toast.error(t('officer.assigned.selectStatus'));
      return;
    }

    try {
      await updateStatus.mutateAsync({
        complaintId: selectedComplaint.complaint_id,
        status: statusUpdate,
      });
      toast.success(t('officer.assigned.updated'));
      setShowModal(false);
    } catch (error) {
      toast.error(t('officer.assigned.updateFailed'));
    }
  };

  const paginatedComplaints = filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredComplaints.length / pageSize);
  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="h2 fw-bold mb-2">
            <i className="fas fa-tasks me-2 text-primary"></i>
            {t('officer.assigned.title')}
          </h1>
        </Col>
      </Row>

      <Card className="border-0 shadow-lg mb-4">
        <Card.Body className="p-3">
          <Form.Group>
            <Form.Label className="small fw-bold">{t('common.filterByStatus')}</Form.Label>
            <Form.Select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              size="sm"
            >
              <option value="">{t('common.allStatus')}</option>
              <option value="pending">{t('status.pending')}</option>
              <option value="in_progress">{t('status.in_progress')}</option>
              <option value="resolved">{t('status.resolved')}</option>
            </Form.Select>
          </Form.Group>
        </Card.Body>
      </Card>

      {isLoading ? (
        <LoadingState variant="table" label={t('officer.assigned.loading')} />
      ) : isError ? (
        <ErrorState message={t('officer.assigned.loadFailed')} onRetry={refetch} />
      ) : filteredComplaints.length === 0 ? (
        <Card className="border-0 shadow-sm">
          {(data || []).length === 0 ? (
            <EmptyState
              icon="tasks"
              title={t('officer.assigned.emptyTitle')}
              text={t('officer.assigned.emptyText')}
            />
          ) : (
            <EmptyState
              icon="filter"
              title={t('officer.assigned.filterEmptyTitle')}
              text={t('officer.assigned.filterEmptyText')}
              action={{ label: t('officer.assigned.clearFilter'), onClick: () => setFilters({ status: '' }), variant: 'outline-secondary' }}
            />
          )}
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-lg">
            <Table responsive className="mb-0">
              <thead className="table-primary">
                <tr>
                  <th>{t('common.id')}</th>
                  <th>{t('common.title')}</th>
                  <th>{t('common.category')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('officer.assigned.citizen')}</th>
                  <th>{t('status.assigned')}</th>
                  <th>{t('common.action')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id}>
                    <td className="fw-bold">#{complaint.complaint_id}</td>
                    <td>{complaint.title}</td>
                    <td className="text-capitalize">{categoryLabel(t, complaint.category)}</td>
                    <td><StatusBadge status={complaint.status} /></td>
                    <td>{complaint.citizen_name}</td>
                    <td className="small text-muted">
                      {formatDate(complaint.assigned_at)}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => {
                          setSelectedComplaint(complaint);
                          setStatusUpdate(complaint.status);
                          setShowModal(true);
                        }}
                      >
                        {t('officer.assigned.update')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <Pagination className="justify-content-center mt-4">
              <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
              <Pagination.Prev onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} />
              {[...Array(totalPages)].map((_, i) => (
                <Pagination.Item key={i + 1} active={i + 1 === currentPage} onClick={() => setCurrentPage(i + 1)}>
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} />
              <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
            </Pagination>
          )}
        </>
      )}

      {/* Status Update Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('officer.assigned.modalTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedComplaint && (
            <>
              <p className="mb-3">
                <strong>
                  {t('citizen.details.complaintNumber', { id: selectedComplaint.complaint_id })}: {selectedComplaint.title}
                </strong>
              </p>
              <Form.Group>
                <Form.Label>{t('officer.assigned.newStatus')}</Form.Label>
                <Form.Select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)}>
                  <option value="pending">{t('status.pending')}</option>
                  <option value="in_progress">{t('status.in_progress')}</option>
                  <option value="resolved">{t('status.resolved')}</option>
                  <option value="rejected">{t('status.rejected')}</option>
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleUpdateStatus}>
            {t('officer.assigned.updateStatus')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default AssignedComplaints;
