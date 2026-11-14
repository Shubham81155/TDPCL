// src/pages/Officer/AssignedComplaints.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, Spinner, Modal, Pagination } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { formatComplaintCategory } from '../../utils/classificationUtils';

function AssignedComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [filters, setFilters] = useState({ status: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const pageSize = 10;

  useEffect(() => {
    loadAssignedComplaints();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [complaints, filters]);

  const loadAssignedComplaints = async () => {
    try {
      const response = await apiClient.get('/complaints/officer/assigned');
      setComplaints(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load assigned complaints');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = complaints;
    if (filters.status) {
      filtered = filtered.filter((c) => c.status === filters.status);
    }
    setFilteredComplaints(filtered);
    setCurrentPage(1);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdate) {
      toast.error('Please select a status');
      return;
    }

    try {
      await apiClient.patch(`/complaints/${selectedComplaint.complaint_id}/status`, {
        status: statusUpdate,
      });
      toast.success('Status updated successfully');
      setShowModal(false);
      loadAssignedComplaints();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'warning',
      in_progress: 'primary',
      resolved: 'success',
      rejected: 'danger',
    };
    return <Badge bg={variants[status] || 'secondary'}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const paginatedComplaints = filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredComplaints.length / pageSize);
  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-tasks me-2 text-primary"></i>
            Assigned Complaints
          </h2>
        </Col>
      </Row>

      <Card className="border-0 shadow-lg mb-4">
        <Card.Body className="p-3">
          <Form.Group>
            <Form.Label className="small fw-bold">Filter by Status</Form.Label>
            <Form.Select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              size="sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </Form.Select>
          </Form.Group>
        </Card.Body>
      </Card>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : filteredComplaints.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <p className="text-muted">No complaints assigned to you yet</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-lg">
            <Table responsive className="mb-0">
              <thead className="table-primary">
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Citizen</th>
                  <th>Assigned</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id}>
                    <td className="fw-bold">#{complaint.complaint_id}</td>
                    <td>{complaint.title}</td>
                    <td className="text-capitalize">{formatComplaintCategory(complaint.category)}</td>
                    <td>{getStatusBadge(complaint.status)}</td>
                    <td>{complaint.citizen_name}</td>
                    <td className="small text-muted">
                      {new Date(complaint.assigned_at).toLocaleDateString()}
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
                        Update
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
          <Modal.Title>Update Complaint Status</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedComplaint && (
            <>
              <p className="mb-3">
                <strong>Complaint #{selectedComplaint.complaint_id}: {selectedComplaint.title}</strong>
              </p>
              <Form.Group>
                <Form.Label>New Status</Form.Label>
                <Form.Select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateStatus}>
            Update Status
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default AssignedComplaints;
