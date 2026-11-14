// src/pages/Admin/Reports.jsx
import React from 'react';
import { Container, Alert, Button, Row, Col, Card } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

function AdminReports() {
  const handleExportCSV = async () => {
    try {
      const response = await apiClient.get('/admin/report/export', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `complaints-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-file-csv me-2 text-success"></i>
        Reports & Export
      </h2>

      <Row className="mb-4">
        <Col md={6}>
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">Export Options</Card.Title>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-3">Download complaint data in various formats</p>
              <div className="d-grid gap-2">
                <Button variant="success" block onClick={handleExportCSV}>
                  <i className="fas fa-download me-2"></i>
                  Export as CSV
                </Button>
                <Button variant="outline-primary" disabled>
                  <i className="fas fa-file-pdf me-2"></i>
                  Export as PDF (Coming Soon)
                </Button>
                <Button variant="outline-info" disabled>
                  <i className="fas fa-file-excel me-2"></i>
                  Export as Excel (Coming Soon)
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-info text-white">
              <Card.Title className="mb-0">Report Types</Card.Title>
            </Card.Header>
            <Card.Body>
              <Alert variant="info" className="small">
                <i className="fas fa-info-circle me-2"></i>
                Select date range and filters before exporting:
              </Alert>
              <ul className="mb-0 small">
                <li>Complaints by status</li>
                <li>Complaints by category</li>
                <li>Officer performance report</li>
                <li>Ward-wise analysis</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default AdminReports;
