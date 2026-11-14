// src/pages/Admin/Wards.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Container, Row, Col, Card, Table, Spinner, Alert, Form, Button, Modal } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '',
  city: '',
  state: '',
  boundaryTouched: false,
  mode: 'bbox',
  south: '',
  west: '',
  north: '',
  east: '',
  geojson: '',
};

const parseNum = (v) => (String(v).trim() === '' ? NaN : Number(v));

// Returns { polygon } or { error }
function buildBbox(f) {
  const s = parseNum(f.south);
  const w = parseNum(f.west);
  const n = parseNum(f.north);
  const e = parseNum(f.east);
  if ([s, w, n, e].some((x) => !Number.isFinite(x))) {
    return { error: 'South, west, north and east must all be numbers' };
  }
  if (s < -90 || s > 90 || n < -90 || n > 90) return { error: 'Latitude must be between -90 and 90' };
  if (w < -180 || w > 180 || e < -180 || e > 180) return { error: 'Longitude must be between -180 and 180' };
  if (s >= n) return { error: 'South must be less than north' };
  if (w >= e) return { error: 'West must be less than east' };
  return {
    polygon: {
      type: 'Polygon',
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  };
}

function parseGeoJson(text) {
  if (!text.trim()) return { error: 'Paste a GeoJSON Polygon' };
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    return { error: 'Invalid JSON: ' + err.message };
  }
  if (obj && obj.type === 'Feature') obj = obj.geometry;
  if (!obj || obj.type !== 'Polygon' || !Array.isArray(obj.coordinates)) {
    return { error: 'GeoJSON must be a Polygon (type "Polygon" with coordinates)' };
  }
  const ring = obj.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return { error: 'Polygon ring needs at least 4 positions' };
  return { polygon: obj };
}

function AdminWards() {
  const [wards, setWards] = useState([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // ward row or null for create
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadWards = useCallback(async () => {
    try {
      const res = await apiClient.get('/wards');
      setWards(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load wards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWards();
  }, [loadWards]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setBoundaryField = (key, value) =>
    setForm((f) => ({ ...f, [key]: value, boundaryTouched: true }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (w) => {
    setEditing(w);
    setForm({ ...EMPTY_FORM, name: w.name, city: w.city, state: w.state });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (!saving) setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const name = form.name.trim();
    const city = form.city.trim();
    const state = form.state.trim();
    if (!name || !city || !state) {
      setFormError('Name, city and state are required');
      return;
    }

    const payload = { name, city, state };
    if (!editing || form.boundaryTouched) {
      const result = form.mode === 'bbox' ? buildBbox(form) : parseGeoJson(form.geojson);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      payload.boundaries_geojson = result.polygon;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiClient.put(`/wards/${editing.ward_id}`, payload);
        toast.success('Ward updated');
      } else {
        await apiClient.post('/wards', payload);
        toast.success('Ward created');
      }
      setShowModal(false);
      await loadWards();
    } catch (err) {
      const msg = err.response?.data?.error || (editing ? 'Failed to update ward' : 'Failed to create ward');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const filtered = wards.filter((w) =>
    `${w.name} ${w.city} ${w.state}`.toLowerCase().includes(query.toLowerCase())
  );
  const totalOfficers = wards.reduce((n, w) => n + Number(w.officer_count || 0), 0);
  const totalComplaints = wards.reduce((n, w) => n + Number(w.complaint_count || 0), 0);

  const summary = [
    ['Wards', wards.length, 'map'],
    ['Active officers', totalOfficers, 'user-shield'],
    ['Complaints', totalComplaints, 'clipboard-list'],
  ];

  return (
    <Container className="py-4">
      <div className="mb-4 d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="fas fa-map me-2 text-success"></i>Ward Management
          </h2>
          <p className="text-muted mb-0">Administrative wards with their officer coverage and complaint load.</p>
        </div>
        <Button variant="success" onClick={openCreate}>
          <i className="fas fa-plus me-2"></i>Add ward
        </Button>
      </div>

      <Row className="mb-4 g-3">
        {summary.map(([label, value, icon]) => (
          <Col md={4} key={label}>
            <Card className="stat-card h-100">
              <Card.Body className="d-flex align-items-center">
                <div className="stat-icon me-3">
                  <i className={`fas fa-${icon}`}></i>
                </div>
                <div>
                  <div className="text-muted small">{label}</div>
                  <div className="fs-3 fw-bold">{value}</div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Form.Control
            className="mb-3"
            placeholder="Search by ward, city or state"
            aria-label="Search wards"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : filtered.length === 0 ? (
            <Alert variant="info" className="mb-0">
              No wards found.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle">
                <thead>
                  <tr>
                    <th>Ward</th>
                    <th>City</th>
                    <th>State</th>
                    <th className="text-end">Officers</th>
                    <th className="text-end">Complaints</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w) => (
                    <tr key={w.ward_id}>
                      <td className="fw-semibold">{w.name}</td>
                      <td>{w.city}</td>
                      <td>{w.state}</td>
                      <td className="text-end">{w.officer_count}</td>
                      <td className="text-end">{w.complaint_count}</td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => openEdit(w)}
                          aria-label={`Edit ${w.name}`}
                        >
                          <i className="fas fa-edit me-1"></i>Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={closeModal} backdrop="static" centered>
        <Form onSubmit={handleSubmit} noValidate>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>{editing ? 'Edit ward' : 'Add ward'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <Form.Group className="mb-3" controlId="wardName">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} maxLength={255} onChange={(e) => setField('name', e.target.value)} />
            </Form.Group>
            <Row>
              <Col sm={6}>
                <Form.Group className="mb-3" controlId="wardCity">
                  <Form.Label>City</Form.Label>
                  <Form.Control value={form.city} maxLength={255} onChange={(e) => setField('city', e.target.value)} />
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group className="mb-3" controlId="wardState">
                  <Form.Label>State</Form.Label>
                  <Form.Control value={form.state} maxLength={255} onChange={(e) => setField('state', e.target.value)} />
                </Form.Group>
              </Col>
            </Row>

            <Form.Label className="fw-semibold">Boundary</Form.Label>
            {editing && !form.boundaryTouched && (
              <div className="text-muted small mb-2">
                The existing boundary is kept unless you enter a new one below.
              </div>
            )}
            <div className="mb-2">
              <Form.Check
                inline
                type="radio"
                id="mode-bbox"
                name="boundaryMode"
                label="Bounding box"
                checked={form.mode === 'bbox'}
                onChange={() => setField('mode', 'bbox')}
              />
              <Form.Check
                inline
                type="radio"
                id="mode-geojson"
                name="boundaryMode"
                label="GeoJSON Polygon"
                checked={form.mode === 'geojson'}
                onChange={() => setField('mode', 'geojson')}
              />
            </div>

            {form.mode === 'bbox' ? (
              <Row className="g-2">
                {[
                  ['south', 'South (lat)'],
                  ['north', 'North (lat)'],
                  ['west', 'West (lng)'],
                  ['east', 'East (lng)'],
                ].map(([key, label]) => (
                  <Col xs={6} key={key}>
                    <Form.Group controlId={`bbox-${key}`}>
                      <Form.Label className="small mb-1">{label}</Form.Label>
                      <Form.Control
                        type="number"
                        step="any"
                        value={form[key]}
                        onChange={(e) => setBoundaryField(key, e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                ))}
              </Row>
            ) : (
              <Form.Group controlId="wardGeojson">
                <Form.Control
                  as="textarea"
                  rows={6}
                  className="font-monospace small"
                  placeholder='{"type":"Polygon","coordinates":[[[lng,lat],[lng,lat],[lng,lat],[lng,lat]]]}'
                  value={form.geojson}
                  onChange={(e) => setBoundaryField('geojson', e.target.value)}
                />
                <Form.Text className="text-muted">Coordinates are [longitude, latitude]; the ring must be closed.</Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create ward'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default AdminWards;
