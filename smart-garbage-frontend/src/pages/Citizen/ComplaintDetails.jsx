// src/pages/Citizen/ComplaintDetails.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { formatComplaintCategory } from '../../utils/classificationUtils';

function ComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComplaintDetails();
    loadTimeline();
  }, [id]);

  const loadComplaintDetails = async () => {
    try {
      const response = await apiClient.get(`/complaints/${id}`);
      setComplaint(response.data.complaint);
    } catch (error) {
      toast.error('Failed to load complaint details');
      navigate('/citizen/complaints');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimeline = async () => {
    try {
      const response = await apiClient.get(`/complaints/${id}/timeline`);
      setTimeline(response.data.timeline || []);
    } catch (error) {
      console.error('Failed to load timeline');
    }
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

  const formatCoordinate = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(4) : 'N/A';
  };

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="success" />
      </Container>
    );
  }

  if (!complaint) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          Complaint not found
        </Alert>
        <Button onClick={() => navigate('/citizen/complaints')}>Back to Complaints</Button>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Button
        variant="light"
        className="mb-4"
        onClick={() => navigate('/citizen/complaints')}
      >
        <i className="fas fa-arrow-left me-2"></i>
        Back to Complaints
      </Button>

      <Row>
        <Col lg={8}>
          <Card className="border-0 shadow-lg mb-4">
            <Card.Header className="bg-success text-white d-flex justify-content-between align-items-center">
              <Card.Title className="mb-0">
                Complaint #{complaint.complaint_id}
              </Card.Title>
              {getStatusBadge(complaint.status)}
            </Card.Header>

            <Card.Body>
              <h4 className="fw-bold mb-2">{complaint.title}</h4>
              <p className="text-muted mb-4">{complaint.description}</p>

              <Row className="mb-4">
                <Col md={6}>
                  <p className="mb-2">
                    <strong>Category:</strong> {formatComplaintCategory(complaint.category)}
                  </p>
                  <p className="mb-2">
                    <strong>Urgency:</strong> {getUrgencyBadge(complaint.urgency_level)}
                  </p>
                  <p className="mb-2">
                    <strong>Location:</strong> {formatCoordinate(complaint.latitude)}, {formatCoordinate(complaint.longitude)}
                  </p>
                </Col>
                <Col md={6}>
                  <p className="mb-2">
                    <strong>Submitted:</strong>{' '}
                    {new Date(complaint.created_at).toLocaleString()}
                  </p>
                  {complaint.assigned_at && (
                    <p className="mb-2">
                      <strong>Assigned:</strong>{' '}
                      {new Date(complaint.assigned_at).toLocaleString()}
                    </p>
                  )}
                  {complaint.assigned_officer_id && (
                    <p className="mb-0">
                      <strong>Assigned Officer:</strong> {complaint.assigned_officer || 'N/A'}
                    </p>
                  )}
                </Col>
              </Row>

              {complaint.image_path && (
                <div className="mb-4">
                  <p className="fw-bold mb-2">Issue Photo:</p>
                  <img
                    src={complaint.image_path}
                    alt="Complaint"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '5px',
                      border: '1px solid #ddd',
                    }}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="border-0 shadow-lg sticky-top" style={{ top: '20px' }}>
            <Card.Header className="bg-info text-white">
              <Card.Title className="mb-0">Status Information</Card.Title>
            </Card.Header>

            <Card.Body>
              <div className="mb-4 text-center">
                <div className="mb-2">
                  <i
                    className={`fas text-${
                      complaint.status === 'resolved' ? 'success' : 'info'
                    }`}
                    style={{ fontSize: '3rem' }}
                  >
                    {complaint.status === 'resolved' ? '✓' : '○'}
                  </i>
                </div>
                <h5 className="fw-bold">{complaint.status.replace('_', ' ').toUpperCase()}</h5>
              </div>

              <hr />

              <div className="small">
                <p>
                  <strong>Status Progress:</strong>
                </p>
                <div className="progress mb-3">
                  <div
                    className={`progress-bar ${
                      complaint.status === 'resolved'
                        ? 'bg-success'
                        : complaint.status === 'rejected'
                        ? 'bg-danger'
                        : 'bg-info'
                    }`}
                    role="progressbar"
                    style={{
                      width: `${
                        complaint.status === 'new'
                          ? '25%'
                          : complaint.status === 'assigned' || complaint.status === 'pending'
                          ? '50%'
                          : complaint.status === 'in_progress'
                          ? '75%'
                          : complaint.status === 'resolved'
                          ? '100%'
                          : '0%'
                      }`,
                    }}
                  ></div>
                </div>

                <div className="mb-3">
                  <p className="mb-1">
                    <i className="fas fa-check-circle text-success me-2"></i>
                    Reported
                  </p>
                  <p className={`mb-1 ${complaint.status !== 'new' ? 'text-success' : 'text-muted'}`}>
                    <i className={`fas me-2 ${complaint.status !== 'new' ? 'fa-check-circle text-success' : 'fa-circle'}`}></i>
                    Assigned
                  </p>
                  <p
                    className={`mb-1 ${
                      complaint.status === 'in_progress' || complaint.status === 'resolved'
                        ? 'text-success'
                        : 'text-muted'
                    }`}
                  >
                    <i
                      className={`fas me-2 ${
                        complaint.status === 'in_progress' || complaint.status === 'resolved'
                          ? 'fa-check-circle text-success'
                          : 'fa-circle'
                      }`}
                    ></i>
                    In Progress
                  </p>
                  <p
                    className={complaint.status === 'resolved' ? 'text-success' : 'text-muted'}
                  >
                    <i
                      className={`fas me-2 ${
                        complaint.status === 'resolved'
                          ? 'fa-check-circle text-success'
                          : 'fa-circle'
                      }`}
                    ></i>
                    Resolved
                  </p>
                </div>
              </div>

              {complaint.status !== 'resolved' && (
                <Alert variant="info" className="mt-3 small mb-0">
                  <i className="fas fa-info-circle me-2"></i>
                  Your issue is being processed. You will receive updates via email and SMS.
                </Alert>
              )}

              {complaint.status === 'resolved' && (
                <Alert variant="success" className="mt-3 small mb-0">
                  <i className="fas fa-check-circle me-2"></i>
                  Thank you! Your complaint has been successfully resolved.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {timeline.length > 0 && (
        <Row className="mt-4">
          <Col>
            <Card className="border-0 shadow-lg">
              <Card.Header className="bg-success text-white">
                <Card.Title className="mb-0">Activity Timeline</Card.Title>
              </Card.Header>

              <Card.Body>
                <div className="timeline">
                  {timeline.map((event, index) => (
                    <div key={index} className="timeline-item mb-3 pb-3 border-bottom">
                      <div className="d-flex">
                        <div className="flex-shrink-0">
                          <Badge bg="success" className="rounded-pill">
                            {index + 1}
                          </Badge>
                        </div>
                        <div className="flex-grow-1 ms-3">
                          <p className="mb-1 fw-bold">
                            {event.new_status.replace('_', ' ').toUpperCase()}
                          </p>
                          <small className="text-muted d-block mb-1">
                            {new Date(event.created_at).toLocaleString()}
                          </small>
                          {event.comment && (
                            <p className="mb-0 small">{event.comment}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default ComplaintDetails;
