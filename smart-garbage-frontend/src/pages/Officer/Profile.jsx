// src/pages/Officer/Profile.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Spinner } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

function OfficerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfileAndMetrics();
  }, []);

  const loadProfileAndMetrics = async () => {
    try {
      const profileResponse = await apiClient.get('/officers/me');
      setProfile(profileResponse.data.officer);

      const metricsResponse = await apiClient.get('/officers/me/metrics');
      setMetrics(metricsResponse.data.metrics);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row>
        <Col lg={8} className="mx-auto">
          <Card className="border-0 shadow-lg mb-4">
            <Card.Header className="bg-primary text-white">
              <Card.Title className="mb-0">Officer Profile</Card.Title>
            </Card.Header>

            <Card.Body>
              <Row>
                <Col md={3} className="text-center mb-4">
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      backgroundColor: '#007bff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      color: 'white',
                      fontSize: '2rem',
                    }}
                  >
                    <i className="fas fa-user"></i>
                  </div>
                </Col>

                <Col md={9}>
                  <h4 className="fw-bold mb-1">{profile?.name || user?.name}</h4>
                  <p className="text-muted mb-3">Officer ID: {profile?.employee_id || profile?.officer_id || '-'}</p>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control type="email" value={user?.email} disabled />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Phone</Form.Label>
                      <Form.Control type="tel" value={profile?.phone || ''} placeholder="Phone number" disabled />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Assigned Ward</Form.Label>
                      <Form.Control
                        type="text"
                        value={profile?.ward_name || profile?.assigned_area_name || ''}
                        placeholder="Ward assignment"
                        disabled
                      />
                    </Form.Group>
                  </Form>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {metrics && (
            <Card className="border-0 shadow-lg">
              <Card.Header className="bg-success text-white">
                <Card.Title className="mb-0">Performance Metrics</Card.Title>
              </Card.Header>

              <Card.Body>
                <Row>
                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">Total Complaints</p>
                    <h4 className="fw-bold text-primary">{metrics.total_complaints}</h4>
                  </Col>

                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">Resolved</p>
                    <h4 className="fw-bold text-success">{metrics.resolved_count}</h4>
                  </Col>

                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">In Progress</p>
                    <h4 className="fw-bold text-info">{metrics.in_progress_count}</h4>
                  </Col>

                  <Col md={6} className="mb-3">
                    <p className="text-muted small mb-1">Avg Resolution Time</p>
                    <h4 className="fw-bold text-warning">{metrics.avg_resolution_hours}h</h4>
                  </Col>
                </Row>

                <div className="mt-4">
                  <p className="small text-muted mb-1">Resolution Rate</p>
                  <div className="progress">
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{
                        width: `${(metrics.resolved_count / metrics.total_complaints) * 100 || 0}%`,
                      }}
                    >
                      {Math.round((metrics.resolved_count / metrics.total_complaints) * 100 || 0)}%
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default OfficerProfile;
