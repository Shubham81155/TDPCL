// src/pages/Citizen/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function CitizenDashboard() {
  const [stats, setStats] = useState({
    pending_count: 0,
    in_progress_count: 0,
    resolved_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const response = await apiClient.get('/complaints');
      const complaints = response.data.data || [];

      const stats = {
        pending_count: complaints.filter((c) => c.status === 'new' || c.status === 'pending').length,
        in_progress_count: complaints.filter((c) => c.status === 'in_progress').length,
        resolved_count: complaints.filter((c) => c.status === 'resolved').length,
      };

      setStats(stats);
    } catch (error) {
      toast.error('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ icon, title, count, color }) => (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="text-center p-4">
        <div className={`text-${color} mb-3`} style={{ fontSize: '2.5rem' }}>
          <i className={`fas fa-${icon}`}></i>
        </div>
        <h6 className="text-muted mb-2">{title}</h6>
        <h3 className={`text-${color} fw-bold`}>{count}</h3>
      </Card.Body>
    </Card>
  );

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold mb-2">
            <i className="fas fa-home me-2 text-success"></i>
            Welcome, {user?.name || 'Citizen'}!
          </h2>
          <p className="text-muted">Track your garbage complaints and monitor resolution progress.</p>
        </Col>
        <Col md="auto">
          <Link to="/citizen/complaint/new">
            <Button variant="success" size="lg">
              <i className="fas fa-plus me-2"></i>
              Report New Issue
            </Button>
          </Link>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={3}>
          <StatCard icon="clock" title="Pending" count={stats.pending_count} color="warning" />
        </Col>
        <Col md={3}>
          <StatCard icon="spinner" title="In Progress" count={stats.in_progress_count} color="info" />
        </Col>
        <Col md={3}>
          <StatCard icon="check-circle" title="Resolved" count={stats.resolved_count} color="success" />
        </Col>
        <Col md={3}>
          <StatCard
            icon="file"
            title="Total"
            count={stats.pending_count + stats.in_progress_count + stats.resolved_count}
            color="primary"
          />
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">Quick Actions</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Link to="/citizen/complaint/new">
                  <Button variant="outline-success" className="w-100 text-start">
                    <i className="fas fa-plus me-2"></i>
                    Report New Issue
                  </Button>
                </Link>
                <Link to="/citizen/complaints">
                  <Button variant="outline-info" className="w-100 text-start">
                    <i className="fas fa-list me-2"></i>
                    View All Complaints
                  </Button>
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-info text-white">
              <Card.Title className="mb-0">Tips</Card.Title>
            </Card.Header>
            <Card.Body>
              <ul className="mb-0 small">
                <li className="mb-2">Provide clear and accurate location information</li>
                <li className="mb-2">Attach clear photos of the issue</li>
                <li className="mb-2">Mark as urgent if blocking roads or hazardous</li>
                <li>Track your complaints in real-time</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">Recent Activity</Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-0">
                <Link to="/citizen/complaints">View all your complaints</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default CitizenDashboard;
