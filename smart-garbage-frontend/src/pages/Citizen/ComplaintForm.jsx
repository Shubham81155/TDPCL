// src/pages/Citizen/ComplaintForm.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Container, Form, Button, Card, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { getCurrentLocation } from '../../utils/locationUtils';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';
import MapPicker from '../../components/common/MapPicker';
import { useTranslation } from '../../i18n/LanguageContext';
import { categoryLabel } from '../../i18n/labels';
import toast from 'react-hot-toast';
import { queryClient } from '../../queryClient';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const TAP_TARGET = { minHeight: 48 };

const parseCoord = (raw, min, max) => {
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

function ComplaintForm() {
  const { t } = useTranslation();
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
  const fileInputRef = useRef(null);
  const photoButtonRef = useRef(null);
  const detailsRef = useRef(null);
  const latRef = useRef(null);
  const lngRef = useRef(null);
  const categoryRef = useRef(null);
  const navigate = useNavigate();

  // Quietly pre-fill the location if the browser allows it; never blocks the form.
  useEffect(() => {
    let cancelled = false;
    getCurrentLocation()
      .then((location) => {
        if (cancelled || !location) return;
        setFormData((prev) =>
          prev.latitude !== '' || prev.longitude !== ''
            ? prev
            : {
                ...prev,
                latitude: String(location.latitude),
                longitude: String(location.longitude),
              }
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const previewUrl = useMemo(
    () => (formData.image ? URL.createObjectURL(formData.image) : null),
    [formData.image]
  );
  useEffect(
    () => () => {
      if (previewUrl && URL.revokeObjectURL) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const lat = parseCoord(formData.latitude, -90, 90);
  const lng = parseCoord(formData.longitude, -180, 180);
  const pin = lat !== null && lng !== null ? { lat, lng } : null;

  const handlePinChange = ({ lat: newLat, lng: newLng }) => {
    setFormData((prev) => ({ ...prev, latitude: String(newLat), longitude: String(newLng) }));
    setErrors((prev) => ({ ...prev, latitude: '', longitude: '', location: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    // Errors hold catalog keys (under citizen.form.errors) and are translated at render.
    if (!formData.image) newErrors.image = 'imageRequired';
    if (formData.latitude === '' || formData.longitude === '') {
      newErrors.location = 'locationRequired';
      if (formData.latitude === '') newErrors.latitude = 'latRequired';
      if (formData.longitude === '') newErrors.longitude = 'lngRequired';
    }
    if (formData.latitude !== '' && lat === null) {
      newErrors.latitude = 'latRange';
    }
    if (formData.longitude !== '' && lng === null) {
      newErrors.longitude = 'lngRange';
    }
    if (!formData.category) newErrors.category = 'categoryRequired';
    setErrors(newErrors);

    // Focus the first invalid field, in visual order.
    if (newErrors.image) {
      photoButtonRef.current && photoButtonRef.current.focus();
    } else if (newErrors.latitude || newErrors.longitude || newErrors.location) {
      if (detailsRef.current) detailsRef.current.open = true;
      const target = newErrors.longitude && !newErrors.latitude ? lngRef : latRef;
      target.current && target.current.focus();
    } else if (newErrors.category) {
      categoryRef.current && categoryRef.current.focus();
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({
      ...prev,
      [name]: '',
      ...(name === 'latitude' || name === 'longitude' ? { location: '' } : {}),
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (file.size > MAX_IMAGE_BYTES) {
        setErrors((prev) => ({ ...prev, image: 'imageTooLarge' }));
      } else if (!ALLOWED_TYPES.includes(file.type)) {
        setErrors((prev) => ({ ...prev, image: 'imageType' }));
      } else {
        setFormData((prev) => ({ ...prev, image: file }));
        setErrors((prev) => ({ ...prev, image: '' }));
      }
    }
    try {
      e.target.value = ''; // allow picking the same file again
    } catch (err) {
      // some browsers refuse to reset file inputs; harmless
    }
  };

  const openPhotoPicker = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || !validateForm()) return;

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
      // Server messages are shown as returned (English); only our own fallbacks are translated.
      toast.success(response.data?.message || t('citizen.form.success'));
      navigate('/citizen/complaints');
    } catch (error) {
      const errorMsg = error.response?.data?.error || t('citizen.form.failed');
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="py-3 py-md-4 px-3">
      <Row className="mx-0">
        <Col lg={8} className="mx-auto px-0">
          <Card className="border-0 shadow-lg">
            <Card.Header className="bg-success text-white">
              <Card.Title as="h1" className="mb-0 h5">
                <i className="fas fa-plus-circle me-2"></i>
                {t('citizen.form.title')}
              </Card.Title>
            </Card.Header>

            <Card.Body className="p-3 p-md-4">
              <Form onSubmit={handleSubmit} noValidate>
                {/* 1. Photo */}
                <Form.Group className="mb-4">
                  <Form.Label as="div" className="fw-bold">{t('citizen.form.photoLabel')}</Form.Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                    aria-label={t('citizen.form.photoAria')}
                    tabIndex={-1}
                  />

                  {previewUrl ? (
                    <div className="text-center">
                      <img
                        src={previewUrl}
                        alt={t('citizen.form.previewAlt')}
                        className="img-fluid rounded border"
                        style={{ maxHeight: 260, width: '100%', objectFit: 'cover' }}
                      />
                      <Button
                        ref={photoButtonRef}
                        id="complaint-photo-button"
                        variant="outline-secondary"
                        className="w-100 mt-2"
                        style={TAP_TARGET}
                        onClick={openPhotoPicker}
                        disabled={isLoading}
                      >
                        <i className="fas fa-redo me-2" aria-hidden="true"></i>{t('citizen.form.retake')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      ref={photoButtonRef}
                      id="complaint-photo-button"
                      variant="outline-success"
                      className="w-100 d-flex flex-column align-items-center justify-content-center"
                      style={{ minHeight: 140, borderStyle: 'dashed', borderWidth: 2 }}
                      onClick={openPhotoPicker}
                      disabled={isLoading}
                      aria-describedby="complaint-photo-help"
                    >
                      <i className="fas fa-camera fa-2x mb-2" aria-hidden="true"></i>
                      <span className="fs-5">{t('citizen.form.takePhoto')}</span>
                    </Button>
                  )}

                  <Form.Text id="complaint-photo-help" className="text-muted d-block mt-2">
                    {t('citizen.form.photoHelp')}
                  </Form.Text>
                  {errors.image && (
                    <div className="text-danger small mt-1" role="alert">
                      {t(`citizen.form.errors.${errors.image}`)}
                    </div>
                  )}
                </Form.Group>

                {/* 2. Location */}
                <div className="mb-4">
                  <div className="fw-bold mb-2">{t('citizen.form.locationLabel')}</div>
                  <MapPicker value={pin} onChange={handlePinChange} />
                  {errors.location && (
                    <div className="text-danger small mt-2" role="alert">
                      {t(`citizen.form.errors.${errors.location}`)}
                    </div>
                  )}

                  <details ref={detailsRef} className="mt-3">
                    <summary className="py-2" style={TAP_TARGET}>
                      {t('citizen.form.manualCoords')}
                    </summary>
                    <Row className="g-3 mt-0">
                      <Col xs={12} sm={6}>
                        <Form.Group controlId="complaint-latitude">
                          <Form.Label>{t('citizen.form.latitude')}</Form.Label>
                          <Form.Control
                            ref={latRef}
                            type="number"
                            name="latitude"
                            step="any"
                            min={-90}
                            max={90}
                            inputMode="decimal"
                            placeholder={t('citizen.form.latPlaceholder')}
                            value={formData.latitude}
                            onChange={handleChange}
                            isInvalid={!!errors.latitude}
                            style={TAP_TARGET}
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.latitude && t(`citizen.form.errors.${errors.latitude}`)}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Group controlId="complaint-longitude">
                          <Form.Label>{t('citizen.form.longitude')}</Form.Label>
                          <Form.Control
                            ref={lngRef}
                            type="number"
                            name="longitude"
                            step="any"
                            min={-180}
                            max={180}
                            inputMode="decimal"
                            placeholder={t('citizen.form.lngPlaceholder')}
                            value={formData.longitude}
                            onChange={handleChange}
                            isInvalid={!!errors.longitude}
                            style={TAP_TARGET}
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.longitude && t(`citizen.form.errors.${errors.longitude}`)}
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    </Row>
                  </details>
                </div>

                {/* 3. Category */}
                <Form.Group className="mb-4" controlId="complaint-category">
                  <Form.Label className="fw-bold">{t('citizen.form.categoryLabel')}</Form.Label>
                  <Form.Select
                    ref={categoryRef}
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    isInvalid={!!errors.category}
                    style={TAP_TARGET}
                  >
                    <option value="">{t('citizen.form.categorySelect')}</option>
                    {COMPLAINT_CATEGORIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {categoryLabel(t, option.value)}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.category && t(`citizen.form.errors.${errors.category}`)}
                  </Form.Control.Feedback>
                </Form.Group>

                {/* 4. Urgency */}
                <Form.Group className="mb-4" controlId="complaint-urgency">
                  <Form.Label className="fw-bold">{t('citizen.form.urgencyLabel')}</Form.Label>
                  <Form.Select
                    name="urgency_level"
                    value={formData.urgency_level}
                    onChange={handleChange}
                    style={TAP_TARGET}
                  >
                    <option value="low">{t('urgency.low')}</option>
                    <option value="medium">{t('urgency.medium')}</option>
                    <option value="high">{t('citizen.form.urgencyHigh')}</option>
                  </Form.Select>
                </Form.Group>

                {/* 5. Description */}
                <Form.Group className="mb-3" controlId="complaint-description">
                  <Form.Label className="fw-bold">{t('citizen.form.descriptionLabel')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="description"
                    maxLength={1000}
                    placeholder={t('citizen.form.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={handleChange}
                  />
                  <Form.Text className="text-muted">{formData.description.length}/1000</Form.Text>
                </Form.Group>

                {/* 6. Actions (sticky) */}
                <div
                  className="position-sticky bottom-0 bg-body border-top d-flex gap-2 py-3 mt-4"
                  style={{ zIndex: 1020 }}
                >
                  <Button
                    variant="outline-secondary"
                    className="flex-fill"
                    style={TAP_TARGET}
                    onClick={() => navigate('/citizen/complaints')}
                    disabled={isLoading}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="success"
                    type="submit"
                    className="flex-fill fw-bold"
                    style={{ ...TAP_TARGET, flexGrow: 2 }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" className="me-2" aria-hidden="true" />
                        {t('citizen.form.submitting')}
                      </>
                    ) : (
                      t('citizen.form.submit')
                    )}
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
