// src/pages/Citizen/ComplaintTracker.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, Spinner, Pagination } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useMyComplaints } from '../../hooks/useComplaints';
import { COMPLAINT_CATEGORIES, formatComplaintCategory } from '../../utils/classificationUtils';

function ComplaintTracker() {
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useMyComplaints();

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

  const getStatusBadge = (status) => {
    const variants = {
      new: 'primary',
      assigned: 'info',
      pending: 'warning',
      in_progress: 'primary',
      resolved: 'success',
      rejected: 'danger',
    };
    return <Badge bg={variants[status] || 'secondary'}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const getUrgencyBadge = (urgency) => {
    const variants = {
      low: 'success',
      medium: 'warning',
      high: 'danger',
    };
    return <Badge bg={variants[urgency] || 'secondary'}>{urgency.toUpperCase()}</Badge>;
  };

  const paginatedComplaints = filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredComplaints.length / pageSize);

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-list me-2 text-success"></i>
            My Complaints
          </h2>
          <p className="text-muted">Track all your reported issues and their status</p>
        </Col>
        <Col md="auto">
          <Link to="/citizen/complaint/new">
            <Button variant="success">
              <i className="fas fa-plus me-2"></i>
              Report New Issue
            </Button>
          </Link>
        </Col>
      </Row>

      <Card className="border-0 shadow-lg mb-4">
        <Card.Body className="p-3">
          <Row>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="small fw-bold">Filter by Status</Form.Label>
                <Form.Select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  size="sm"
                >
                  <option value="">All Status</option>
                  <option value="new">New</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="small fw-bold">Filter by Category</Form.Label>
                <Form.Select
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                  size="sm"
                >
                  <option value="">All Categories</option>
                  {COMPLAINT_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      ) : filteredComplaints.length === 0 ? (
        <Alert variant="info">
          <i className="fas fa-info-circle me-2"></i>
          No complaints found. <Link to="/citizen/complaint/new">Report a new issue</Link>
        </Alert>
      ) : (
        <>
          <Card className="border-0 shadow-lg">
            <Table responsive className="mb-0">
              <thead className="table-success">
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id}>
                    <td className="fw-bold">#{complaint.complaint_id}</td>
                    <td>{complaint.title}</td>
                    <td>{formatComplaintCategory(complaint.category)}</td>
                    <td>{getUrgencyBadge(complaint.urgency_level)}</td>
                    <td>{getStatusBadge(complaint.status)}</td>
                    <td className="small text-muted">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/citizen/complaint/${complaint.complaint_id}`}>
                        <Button variant="primary" size="sm">
                          View
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

const Alert = ({ variant, children }) => (
  <div className={`alert alert-${variant}`} role="alert">
    {children}
  </div>
);

export default ComplaintTracker;
