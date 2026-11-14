// src/pages/Citizen/Dashboard.jsx
import React, { useMemo } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useMyComplaints } from '../../hooks/useComplaints';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';

function CitizenDashboard() {
  const { data, isLoading } = useMyComplaints();
  const { user } = useAuth();

  const { stats, recent } = useMemo(() => {
    const complaints = data || [];
    return {
      stats: {
        // "Pending" = waiting to be worked on (includes complaints already assigned to an officer)
        pending_count: complaints.filter((c) => ['new', 'pending', 'assigned'].includes(c.status)).length,
        in_progress_count: complaints.filter((c) => c.status === 'in_progress').length,
        resolved_count: complaints.filter((c) => c.status === 'resolved').length,
        // every complaint, including rejected ones
        total_count: complaints.length,
      },
      recent: complaints.slice(0, 5),
    };
  }, [data]);

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
            count={stats.total_count}
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
              {isLoading ? (
                <p className="text-muted mb-0">Loading...</p>
              ) : recent.length === 0 ? (
                <p className="text-muted mb-0">
                  No complaints yet. <Link to="/citizen/complaint/new">Report your first issue</Link>.
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {recent.map((c) => (
                    <Link
                      key={c.complaint_id}
                      to={`/citizen/complaint/${c.complaint_id}`}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0"
                    >
                      <span>
                        <strong>#{c.complaint_id}</strong>{' '}
                        <span className="text-muted">
                          {(c.category || 'garbage').replace(/_/g, ' ')} · {c.area || 'Unknown area'}
                        </span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  ))}
                  <Link to="/citizen/complaints" className="small pt-2">
                    View all complaints →
                  </Link>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default CitizenDashboard;
