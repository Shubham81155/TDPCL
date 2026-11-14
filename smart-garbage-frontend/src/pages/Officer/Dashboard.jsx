// src/pages/Officer/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function OfficerDashboard() {
  const [stats, setStats] = useState({
    pending_count: 0,
    in_progress_count: 0,
    resolved_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/complaints/officer/assigned');
      const complaints = response.data.data || [];

      setStats({
        pending_count: complaints.filter((c) => c.status === 'assigned' || c.status === 'pending').length,
        in_progress_count: complaints.filter((c) => c.status === 'in_progress').length,
        resolved_count: complaints.filter((c) => c.status === 'resolved').length,
      });
    } catch (error) {
      console.error('Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  const total = stats.pending_count + stats.in_progress_count + stats.resolved_count;
  const resolutionRate = total ? Math.round((stats.resolved_count / total) * 100) : 0;

  const StatCard = ({ icon, title, count, color, link }) => (
    <Link to={link} className="text-decoration-none">
      <Card className="border-0 shadow-sm h-100 cursor-pointer" style={{ transition: 'all 0.3s ease' }}>
        <Card.Body className="text-center p-4">
          <div className={`text-${color} mb-3`} style={{ fontSize: '2.5rem' }}>
            <i className={`fas fa-${icon}`}></i>
          </div>
          <h6 className="text-muted mb-2">{title}</h6>
          <h3 className={`text-${color} fw-bold`}>{count}</h3>
        </Card.Body>
      </Card>
    </Link>
  );

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-home me-2 text-primary"></i>
            Officer Dashboard
          </h2>
          <p className="text-muted">Welcome, {user?.name || 'Officer'}! Manage your assigned complaints.</p>
        </Col>
      </Row>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          <Row className="mb-4">
            <Col md={3}>
              <StatCard
                icon="clock"
                title="Pending"
                count={stats.pending_count}
                color="warning"
                link="/officer/complaints?status=pending"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="spinner"
                title="In Progress"
                count={stats.in_progress_count}
                color="info"
                link="/officer/complaints?status=in_progress"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="check-circle"
                title="Resolved"
                count={stats.resolved_count}
                color="success"
                link="/officer/complaints?status=resolved"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="file"
                title="Total"
                count={stats.pending_count + stats.in_progress_count + stats.resolved_count}
                color="primary"
                link="/officer/complaints"
              />
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-primary text-white">
                  <Card.Title className="mb-0">Quick Actions</Card.Title>
                </Card.Header>
                <Card.Body>
                  <div className="d-grid gap-2">
                    <Link to="/officer/complaints">
                      <Button variant="outline-primary" className="w-100 text-start">
                        <i className="fas fa-tasks me-2"></i>
                        View All Assignments
                      </Button>
                    </Link>
                    <Link to="/officer/map">
                      <Button variant="outline-info" className="w-100 text-start">
                        <i className="fas fa-map me-2"></i>
                        Map View
                      </Button>
                    </Link>
                    <Link to="/officer/profile">
                      <Button variant="outline-secondary" className="w-100 text-start">
                        <i className="fas fa-user me-2"></i>
                        My Profile
                      </Button>
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-info text-white">
                  <Card.Title className="mb-0">Performance</Card.Title>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <p className="small text-muted mb-1">Resolution Rate</p>
                    <div className="progress">
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        aria-valuenow={resolutionRate}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        style={{ width: `${resolutionRate}%` }}
                      >
                        {resolutionRate}%
                      </div>
                    </div>
                  </div>
                  <p className="small">
                    <i className="fas fa-info-circle me-2"></i>
                    {total === 0
                      ? 'No complaints assigned yet.'
                      : resolutionRate >= 70
                      ? 'Keep up the excellent work!'
                      : `${stats.resolved_count} of ${total} assigned complaints resolved.`}
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default OfficerDashboard;
