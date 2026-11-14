// src/pages/Admin/Analytics.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

function AdminAnalytics() {
  const [categoryStats, setCategoryStats] = useState([]);
  const [wardStats, setWardStats] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [categoryRes, wardRes, officersRes] = await Promise.all([
        apiClient.get('/admin/stats/by-category'),
        apiClient.get('/admin/stats/by-ward'),
        apiClient.get('/admin/stats/officer-performance?limit=10'),
      ]);

      setCategoryStats(categoryRes.data.data || []);
      setWardStats(wardRes.data.data || []);
      setOfficers(officersRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="success" />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-chart-bar me-2 text-success"></i>
        Analytics & Reports
      </h2>

      <Row className="mb-4">
        <Col lg={6}>
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">Complaints by Category</Card.Title>
            </Card.Header>
            <Card.Body>
              {categoryStats.map((cat, idx) => (
                <div key={idx} className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>{cat.category}</span>
                    <span className="fw-bold">{cat.count}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar bg-success" style={{ width: `${(cat.resolved / cat.count) * 100}%` }}>
                      {Math.round((cat.resolved / cat.count) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-info text-white">
              <Card.Title className="mb-0">Top Officers</Card.Title>
            </Card.Header>
            <Card.Body>
              {officers.slice(0, 5).map((officer, idx) => (
                <div key={idx} className="mb-3 pb-3 border-bottom">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="fw-bold">{idx + 1}. {officer.officer_name}</span>
                    <span className="badge bg-success">{officer.resolution_rate}%</span>
                  </div>
                  <small className="text-muted">{officer.resolved} / {officer.total_complaints} resolved</small>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-primary text-white">
              <Card.Title className="mb-0">Complaints by Ward</Card.Title>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Ward</th>
                      <th>Total</th>
                      <th>Resolved</th>
                      <th>Officers</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wardStats.map((ward, idx) => (
                      <tr key={idx}>
                        <td className="fw-bold">{ward.name}</td>
                        <td>{ward.total_complaints}</td>
                        <td>{ward.resolved}</td>
                        <td>{ward.officer_count}</td>
                        <td>
                          <span className="badge bg-success">
                            {Math.round((ward.resolved / ward.total_complaints) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default AdminAnalytics;
