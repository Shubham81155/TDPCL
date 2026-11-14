// src/pages/Admin/Officers.jsx
import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Form, Modal, Alert, Row, Col, Card } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import { queryClient } from '../../queryClient';

function AdminOfficers() {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    employee_id: '',
    assigned_area_name: '',
    year_of_joining: new Date().getFullYear(),
  });

  const [errors, setErrors] = useState({});

  // Fetch officers
  useEffect(() => {
    fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/officers');
      setOfficers(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load officers');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!formData.employee_id) newErrors.employee_id = 'Employee ID is required';
    if (!formData.assigned_area_name) newErrors.assigned_area_name = 'Assigned area is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      employee_id: '',
      assigned_area_name: '',
      year_of_joining: new Date().getFullYear(),
    });
    setErrors({});
  };

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await apiClient.post('/officers', {
        email: formData.email,
        password: formData.password,
        employee_id: formData.employee_id,
        assigned_area_name: formData.assigned_area_name,
        year_of_joining: parseInt(formData.year_of_joining),
      });

      toast.success('Officer added successfully!');
      setShowModal(false);
      resetForm();
      fetchOfficers();
      queryClient.invalidateQueries('admin');
      queryClient.invalidateQueries('wards');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to add officer';
      toast.error(errorMsg);
    }
  };

  const handleDeleteOfficer = async (officerId) => {
    if (window.confirm('Are you sure you want to delete this officer?')) {
      try {
        await apiClient.delete(`/officers/${officerId}`);
        toast.success('Officer deleted successfully!');
        fetchOfficers();
        queryClient.invalidateQueries('admin');
        queryClient.invalidateQueries('wards');
      } catch (error) {
        toast.error('Failed to delete officer');
      }
    }
  };

  const filteredOfficers = officers.filter(
    (officer) =>
      officer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      officer.employee_id.includes(searchTerm) ||
      officer.assigned_area_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">
          <i className="fas fa-users me-2 text-primary"></i>
          Officer Management
        </h2>
        <Button variant="success" onClick={() => setShowModal(true)}>
          <i className="fas fa-plus me-2"></i>Add Officer
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <h4 className="text-success">{officers.length}</h4>
              <small className="text-muted">Total Officers</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <h4 className="text-info">{officers.filter(o => o.status === 'active').length}</h4>
              <small className="text-muted">Active Officers</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <h4 className="text-warning">{officers.filter(o => o.status === 'on_leave').length}</h4>
              <small className="text-muted">On Leave</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <div className="mb-3">
        <Form.Control
          placeholder="Search by email, employee ID, or area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="py-2"
        />
      </div>

      {/* Officers Table */}
      {loading ? (
        <LoadingState variant="table" label="Loading officers" />
      ) : filteredOfficers.length === 0 ? (
        officers.length === 0 ? (
          <EmptyState
            icon="user-shield"
            title="No officers yet"
            text="No officers found. Add your first officer to get started!"
            action={{ label: 'Add your first officer', onClick: () => setShowModal(true), icon: 'plus' }}
            className="py-4"
          />
        ) : (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2"></i>
            No officers match your search.
          </Alert>
        )
      ) : (
        <div className="table-responsive">
          <Table hover className="border-0 shadow-sm">
            <thead className="bg-light">
              <tr>
                <th>Email</th>
                <th>Employee ID</th>
                <th>Assigned Area</th>
                <th>Year of Joining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOfficers.map((officer) => (
                <tr key={officer.officer_id}>
                  <td className="fw-bold">{officer.email}</td>
                  <td>{officer.employee_id}</td>
                  <td>{officer.assigned_area_name}</td>
                  <td>{officer.year_of_joining}</td>
                  <td>
                    <span
                      className={`badge ${
                        officer.status === 'active'
                          ? 'bg-success'
                          : officer.status === 'on_leave'
                          ? 'bg-warning text-dark'
                          : 'bg-danger'
                      }`}
                    >
                      <i
                        className={`fa-solid me-1 ${
                          officer.status === 'active'
                            ? 'fa-circle-check'
                            : officer.status === 'on_leave'
                            ? 'fa-clock'
                            : 'fa-circle-xmark'
                        }`}
                        aria-hidden="true"
                      ></i>
                      {officer.status}
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      size="sm"
                      aria-label={`Delete officer ${officer.email}`}
                      onClick={() => handleDeleteOfficer(officer.officer_id)}
                    >
                      <i className="fas fa-trash" aria-hidden="true"></i>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Add Officer Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add New Officer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAddOfficer}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address *</Form.Label>
              <Form.Control
                type="email"
                name="email"
                placeholder="officer@example.com"
                value={formData.email}
                onChange={handleChange}
                isInvalid={!!errors.email}
              />
              <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password *</Form.Label>
              <Form.Control
                type="password"
                name="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                isInvalid={!!errors.password}
              />
              <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Employee ID *</Form.Label>
              <Form.Control
                type="text"
                name="employee_id"
                placeholder="e.g., EMP001"
                value={formData.employee_id}
                onChange={handleChange}
                isInvalid={!!errors.employee_id}
              />
              <Form.Control.Feedback type="invalid">{errors.employee_id}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Assigned Area *</Form.Label>
              <Form.Control
                type="text"
                name="assigned_area_name"
                placeholder="e.g., Downtown District"
                value={formData.assigned_area_name}
                onChange={handleChange}
                isInvalid={!!errors.assigned_area_name}
              />
              <Form.Control.Feedback type="invalid">{errors.assigned_area_name}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Year of Joining</Form.Label>
              <Form.Control
                type="number"
                name="year_of_joining"
                min="2000"
                max={new Date().getFullYear()}
                value={formData.year_of_joining}
                onChange={handleChange}
              />
            </Form.Group>

            <div className="d-grid gap-2">
              <Button variant="success" type="submit">
                Add Officer
              </Button>
              <Button variant="light" onClick={() => { setShowModal(false); resetForm(); }}>
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default AdminOfficers;
