// src/pages/Citizen/ComplaintDetails.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import LoadingState from '../../components/common/LoadingState';
import StatusBadge, { UrgencyBadge, STATUS_ICONS } from '../../components/common/StatusBadge';
import { useTranslation } from '../../i18n/LanguageContext';
import { categoryLabel, statusLabel } from '../../i18n/labels';

function ComplaintDetails() {
  const { t, formatDateTime } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComplaintDetails();
    loadTimeline();
    // Reload only when the complaint id changes; the loaders are re-created every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadComplaintDetails = async () => {
    try {
      const response = await apiClient.get(`/complaints/${id}`);
      setComplaint(response.data.complaint);
    } catch (error) {
      toast.error(t('citizen.details.loadFailed'));
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

  const formatCoordinate = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(4) : t('common.na');
  };

  if (isLoading) {
    return (
      <Container className="py-4">
        <LoadingState variant="detail" label={t('citizen.details.loading')} />
      </Container>
    );
  }

  if (!complaint) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {t('citizen.details.notFound')}
        </Alert>
        <Button onClick={() => navigate('/citizen/complaints')}>{t('citizen.details.back')}</Button>
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
        {t('citizen.details.back')}
      </Button>

      <Row>
        <Col lg={8}>
          <Card className="border-0 shadow-lg mb-4">
            <Card.Header className="bg-success text-white d-flex justify-content-between align-items-center">
              <Card.Title className="mb-0">
                {t('citizen.details.complaintNumber', { id: complaint.complaint_id })}
              </Card.Title>
              <StatusBadge status={complaint.status} />
            </Card.Header>

            <Card.Body>
              <h4 className="fw-bold mb-2">{complaint.title}</h4>
              <p className="text-muted mb-4">{complaint.description}</p>

              <Row className="mb-4">
                <Col md={6}>
                  <p className="mb-2">
                    <strong>{t('citizen.details.category')}</strong> {categoryLabel(t, complaint.category)}
                  </p>
                  <p className="mb-2">
                    <strong>{t('citizen.details.urgency')}</strong> <UrgencyBadge urgency={complaint.urgency_level} />
                  </p>
                  <p className="mb-2">
                    <strong>{t('citizen.details.location')}</strong> {formatCoordinate(complaint.latitude)}, {formatCoordinate(complaint.longitude)}
                  </p>
                </Col>
                <Col md={6}>
                  <p className="mb-2">
                    <strong>{t('citizen.details.submitted')}</strong>{' '}
                    {formatDateTime(complaint.created_at)}
                  </p>
                  {complaint.assigned_at && (
                    <p className="mb-2">
                      <strong>{t('citizen.details.assigned')}</strong>{' '}
                      {formatDateTime(complaint.assigned_at)}
                    </p>
                  )}
                  {complaint.assigned_officer_id && (
                    <p className="mb-0">
                      <strong>{t('citizen.details.assignedOfficer')}</strong> {complaint.assigned_officer || t('common.na')}
                    </p>
                  )}
                </Col>
              </Row>

              {complaint.image_path && (
                <div className="mb-4">
                  <p className="fw-bold mb-2">{t('citizen.details.issuePhoto')}</p>
                  <img
                    src={complaint.image_path}
                    alt={t('citizen.details.photoAlt')}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '5px',
                      border: '1px solid var(--bs-border-color)',
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
              <Card.Title className="mb-0">{t('citizen.details.statusInfo')}</Card.Title>
            </Card.Header>

            <Card.Body>
              <div className="mb-4 text-center">
                <div className="mb-2">
                  <i
                    className={`${STATUS_ICONS[complaint.status] || STATUS_ICONS.unknown} text-${
                      complaint.status === 'resolved' ? 'success' : complaint.status === 'rejected' ? 'danger' : 'info'
                    }`}
                    style={{ fontSize: '3rem' }}
                    aria-hidden="true"
                  ></i>
                </div>
                <h5 className="fw-bold text-capitalize">{statusLabel(t, complaint.status)}</h5>
              </div>

              <hr />

              <div className="small">
                <p>
                  <strong>{t('citizen.details.statusProgress')}</strong>
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
                    <i className="fa-solid fa-circle-check text-success me-2" aria-hidden="true"></i>
                    {t('citizen.details.reported')}
                  </p>
                  <p className={`mb-1 ${complaint.status !== 'new' ? 'text-success' : 'text-muted'}`}>
                    <i className={`fa-solid me-2 ${complaint.status !== 'new' ? 'fa-circle-check text-success' : 'fa-regular fa-circle'}`} aria-hidden="true"></i>
                    {t('status.assigned')}
                  </p>
                  <p
                    className={`mb-1 ${
                      complaint.status === 'in_progress' || complaint.status === 'resolved'
                        ? 'text-success'
                        : 'text-muted'
                    }`}
                  >
                    <i
                      className={`fa-solid me-2 ${
                        complaint.status === 'in_progress' || complaint.status === 'resolved'
                          ? 'fa-circle-check text-success'
                          : 'fa-regular fa-circle'
                      }`}
                    aria-hidden="true"></i>
                    {t('status.in_progress')}
                  </p>
                  <p
                    className={complaint.status === 'resolved' ? 'text-success' : 'text-muted'}
                  >
                    <i
                      className={`fa-solid me-2 ${
                        complaint.status === 'resolved'
                          ? 'fa-circle-check text-success'
                          : 'fa-regular fa-circle'
                      }`}
                    aria-hidden="true"></i>
                    {t('status.resolved')}
                  </p>
                </div>
              </div>

              {complaint.status !== 'resolved' && (
                <Alert variant="info" className="mt-3 small mb-0">
                  <i className="fas fa-info-circle me-2"></i>
                  {t('citizen.details.processing')}
                </Alert>
              )}

              {complaint.status === 'resolved' && (
                <Alert variant="success" className="mt-3 small mb-0">
                  <i className="fas fa-check-circle me-2"></i>
                  {t('citizen.details.thanks')}
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
                <Card.Title className="mb-0">{t('citizen.details.timeline')}</Card.Title>
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
                            <StatusBadge status={event.new_status} />
                          </p>
                          <small className="text-muted d-block mb-1">
                            {formatDateTime(event.created_at)}
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
