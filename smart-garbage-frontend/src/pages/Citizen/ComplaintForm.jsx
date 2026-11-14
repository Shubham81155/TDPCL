// src/pages/Citizen/ComplaintForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Container, Form, Button, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { getCurrentLocation } from '../../utils/locationUtils';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';
import toast from 'react-hot-toast';
import { queryClient } from '../../queryClient';

function ComplaintForm() {
  const [formData, setFormData] = useState({
    latitude: '',
    longitude: '',
    category: '',
    description: '',
    urgency_level: 'medium',
    image: null,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const cameraInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    getDefaultLocation();
  }, []);

  const getDefaultLocation = async () => {
    setGettingLocation(true);
    try {
      const location = await getCurrentLocation();
      setFormData((prev) => ({
        ...prev,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
      }));
      toast.success('Location detected successfully');
    } catch (error) {
      toast.error('Could not detect location. Please enter manually.');
    } finally {
      setGettingLocation(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.latitude) newErrors.latitude = 'Latitude is required';
    if (!formData.longitude) newErrors.longitude = 'Longitude is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.image) newErrors.image = 'Image is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: 'Image size must be less than 10MB' }));
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        setErrors((prev) => ({ ...prev, image: 'Only JPEG, PNG, and GIF are allowed' }));
        return;
      }
      setFormData((prev) => ({ ...prev, image: file }));
      setErrors((prev) => ({ ...prev, image: '' }));
    }
  };

  const openCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('latitude', formData.latitude);
      submitData.append('longitude', formData.longitude);
      submitData.append('category', formData.category);
      if (formData.description.trim()) {
        submitData.append('description', formData.description.trim());
      }
      submitData.append('urgency_level', formData.urgency_level);
      submitData.append('image', formData.image);

      const response = await apiClient.post('/complaints', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      queryClient.invalidateQueries('complaints');
      queryClient.invalidateQueries('admin');
      toast.success(response.data?.message || 'Complaint submitted successfully');
      navigate('/citizen/complaints');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to submit complaint';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="py-4">
      <Row>
        <Col lg={8} className="mx-auto">
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-success text-white">
              <Card.Title className="mb-0">
                <i className="fas fa-plus-circle me-2"></i>
                Report a New Issue
              </Card.Title>
            </Card.Header>

            <Card.Body className="p-4">
              <Alert variant="info">
                <i className="fas fa-info-circle me-2"></i>
                Please choose the most accurate category and upload a clear photo of the issue.
              </Alert>

              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Latitude *</Form.Label>
                      <Form.Control
                        type="number"
                        name="latitude"
                        step="0.0001"
                        placeholder="e.g., 19.0760"
                        value={formData.latitude}
                        onChange={handleChange}
                        isInvalid={!!errors.latitude}
                      />
                      <Form.Control.Feedback type="invalid">{errors.latitude}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Longitude *</Form.Label>
                      <Form.Control
                        type="number"
                        name="longitude"
                        step="0.0001"
                        placeholder="e.g., 72.8777"
                        value={formData.longitude}
                        onChange={handleChange}
                        isInvalid={!!errors.longitude}
                      />
                      <Form.Control.Feedback type="invalid">{errors.longitude}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Category *</Form.Label>
                  <Form.Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    isInvalid={!!errors.category}
                  >
                    <option value="">Select a category</option>
                    {COMPLAINT_CATEGORIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.category}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Description (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    maxLength={1000}
                    placeholder="Describe the issue (e.g., overflowing bin near the market gate)"
                    value={formData.description}
                    onChange={handleChange}
                  />
                  <Form.Text className="text-muted">
                    {formData.description.length}/1000
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Urgency</Form.Label>
                  <Form.Select
                    name="urgency_level"
                    value={formData.urgency_level}
                    onChange={handleChange}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High - Urgent</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Button
                    variant="outline-info"
                    onClick={getDefaultLocation}
                    disabled={gettingLocation}
                    className="w-100"
                  >
                    {gettingLocation ? (
                      <>
                        <Spinner size="sm" className="me-2" /> Detecting Location...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-map-marker-alt me-2"></i>
                        Use My Current Location
                      </>
                    )}
                  </Button>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Photo of Issue *</Form.Label>
                  
                  {/* Hidden camera input */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />

                  {/* Camera Button */}
                  <div className="d-grid gap-2 mb-3">
                    <Button
                      variant="primary"
                      onClick={openCamera}
                      className="py-3"
                      disabled={isLoading}
                      size="lg"
                    >
                      <i className="fas fa-camera me-2"></i>Click Picture
                    </Button>
                  </div>

                  <Form.Text className="text-muted d-block mb-3">
                    Accepted formats: JPEG, PNG, GIF | Max size: 10MB
                  </Form.Text>
                  
                  {errors.image && (
                    <Alert variant="danger" className="mb-3">
                      {errors.image}
                    </Alert>
                  )}

                  {formData.image && (
                    <div className="mt-3 text-center">
                      <img
                        src={URL.createObjectURL(formData.image)}
                        alt="Preview"
                        style={{ maxHeight: '250px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                      />
                      <div className="mt-2">
                        <small className="text-muted">
                          <i className="fas fa-check-circle text-success me-2"></i>
                          Photo captured: {formData.image.name}
                        </small>
                      </div>
                    </div>
                  )}
                </Form.Group>

                <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                  <Button
                    variant="light"
                    onClick={() => navigate('/citizen/complaints')}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button variant="success" type="submit" disabled={isLoading}>
                    {isLoading ? 'Submitting...' : 'Submit Complaint'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default ComplaintForm;
