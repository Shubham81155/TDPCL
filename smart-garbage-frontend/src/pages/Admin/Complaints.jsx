// src/pages/Admin/Complaints.jsx
import React, { useEffect, useState } from 'react';
import { Container, Alert, Card, Table, Spinner, Badge } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { formatComplaintCategory } from '../../utils/classificationUtils';

function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    try {
      const response = await apiClient.get('/admin/complaints');
      setComplaints(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      new: 'secondary',
      assigned: 'info',
      pending: 'warning',
      in_progress: 'primary',
      resolved: 'success',
      rejected: 'danger',
    };

    return <Badge bg={variants[status] || 'secondary'}>{status?.replace('_', ' ') || 'unknown'}</Badge>;
  };

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-list me-2 text-success"></i>
        All Complaints
      </h2>
      <Alert variant="info">
        <i className="fas fa-info-circle me-2"></i>
        Category is chosen manually by the citizen when the complaint is submitted.
      </Alert>

      <Card className="border-0 shadow-lg">
        {isLoading ? (
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="success" />
          </Card.Body>
        ) : complaints.length === 0 ? (
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-0">No complaints found</p>
          </Card.Body>
        ) : (
          <Table responsive className="mb-0">
            <thead className="table-success">
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Citizen</th>
                <th>Area</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.complaint_id}>
                  <td className="fw-bold">#{complaint.complaint_id}</td>
                  <td>{complaint.title}</td>
                  <td className="text-capitalize">{formatComplaintCategory(complaint.category)}</td>
                  <td>{getStatusBadge(complaint.status)}</td>
                  <td>{complaint.citizen_name || '-'}</td>
                  <td>{complaint.area || '-'}</td>
                  <td className="small text-muted">{new Date(complaint.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Container>
  );
}

export default AdminComplaints;
