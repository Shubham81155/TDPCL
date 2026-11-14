// src/pages/Admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/admin/stats/complaints');
      setStats(response.data.stats);
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
            <i className="fas fa-chart-line me-2 text-success"></i>
            Admin Dashboard
          </h2>
          <p className="text-muted">System-wide statistics and analytics</p>
        </Col>
      </Row>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="success" />
        </div>
      ) : stats ? (
        <>
          <Row className="mb-4">
            <Col md={3}>
              <StatCard
                icon="inbox"
                title="Total Complaints"
                count={stats.total_complaints}
                color="success"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="exclamation-circle"
                title="New"
                count={stats.new_count}
                color="primary"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="spinner"
                title="In Progress"
                count={stats.in_progress_count}
                color="info"
              />
            </Col>
            <Col md={3}>
              <StatCard
                icon="check-circle"
                title="Resolved"
                count={stats.resolved_count}
                color="success"
              />
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={3}>
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4 text-center">
                  <p className="text-muted small mb-2">High Urgency</p>
                  <h4 className="fw-bold text-danger">{stats.high_urgency_count}</h4>
                  <small className="text-muted">{((stats.high_urgency_count / stats.total_complaints) * 100).toFixed(1)}% of total</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4 text-center">
                  <p className="text-muted small mb-2">Avg Resolution Time</p>
                  <h4 className="fw-bold text-info">{stats.avg_resolution_hours}h</h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-success text-white">
                  <Card.Title className="mb-0">Quick Actions</Card.Title>
                </Card.Header>
                <Card.Body>
                  <a href="/admin/complaints" className="d-block mb-2">
                    <i className="fas fa-tasks me-2"></i>Manage Complaints
                  </a>
                  <a href="/admin/officers" className="d-block mb-2">
                    <i className="fas fa-users me-2"></i>Manage Officers
                  </a>
                  <a href="/admin/analytics" className="d-block mb-2">
                    <i className="fas fa-chart-bar me-2"></i>View Analytics
                  </a>
                  <a href="/admin/reports" className="d-block">
                    <i className="fas fa-file-csv me-2"></i>Generate Reports
                  </a>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      ) : null}
    </Container>
  );
}

export default AdminDashboard;
