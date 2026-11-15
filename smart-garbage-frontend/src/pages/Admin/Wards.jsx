// src/pages/Admin/Wards.jsx
import React, { useState } from 'react';
import { Container, Row, Col, Card, Table, Alert, Form, Button, Modal } from 'react-bootstrap';
import { useWards, useSaveWard } from '../../hooks/useWards';
import EmptyState from '../../components/common/EmptyState';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { useTranslation } from '../../i18n/LanguageContext';
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

const touch = { minHeight: 44 };
const parseNum = (v) => (String(v).trim() === '' ? NaN : Number(v));

// Returns { polygon } or { error }
function buildBbox(f, t) {
  const s = parseNum(f.south);
  const w = parseNum(f.west);
  const n = parseNum(f.north);
  const e = parseNum(f.east);
  if ([s, w, n, e].some((x) => !Number.isFinite(x))) return { error: t('admin.wards.errBboxNumbers') };
  if (s < -90 || s > 90 || n < -90 || n > 90) return { error: t('admin.wards.errLat') };
  if (w < -180 || w > 180 || e < -180 || e > 180) return { error: t('admin.wards.errLng') };
  if (s >= n) return { error: t('admin.wards.errSouthNorth') };
  if (w >= e) return { error: t('admin.wards.errWestEast') };
  return {
    polygon: {
      type: 'Polygon',
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  };
}

function parseGeoJson(text, t) {
  if (!text.trim()) return { error: t('admin.wards.errGeoEmpty') };
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    return { error: t('admin.wards.errGeoInvalid', { message: err.message }) };
  }
  if (obj && obj.type === 'Feature') obj = obj.geometry;
  if (!obj || obj.type !== 'Polygon' || !Array.isArray(obj.coordinates)) {
    return { error: t('admin.wards.errGeoType') };
  }
  const ring = obj.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return { error: t('admin.wards.errGeoRing') };
  return { polygon: obj };
}

function AdminWards() {
  const { t } = useTranslation();
  const { data: wardsData, isLoading, isError, refetch } = useWards();
  const wards = wardsData || [];
  const saveWard = useSaveWard();
  const [query, setQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // ward row or null for create
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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
      setFormError(t('admin.wards.errRequired'));
      return;
    }

    const payload = { name, city, state };
    if (!editing || form.boundaryTouched) {
      const result = form.mode === 'bbox' ? buildBbox(form, t) : parseGeoJson(form.geojson, t);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      payload.boundaries_geojson = result.polygon;
    }

    setSaving(true);
    try {
      await saveWard.mutateAsync({ id: editing?.ward_id, body: payload });
      toast.success(editing ? t('admin.wards.updated') : t('admin.wards.created'));
      setShowModal(false);
    } catch (err) {
      const msg =
        err.response?.data?.error || (editing ? t('admin.wards.updateFailed') : t('admin.wards.createFailed'));
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
    [t('admin.wards.statWards'), wards.length, 'map'],
    [t('admin.wards.statOfficers'), totalOfficers, 'user-shield'],
    [t('admin.wards.statComplaints'), totalComplaints, 'clipboard-list'],
  ];

  const errId = 'ward-form-error';
  const textField = (id, key, label) => (
    <Form.Group className="mb-3" controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        value={form[key]}
        maxLength={255}
        required
        style={touch}
        isInvalid={!!formError && !form[key].trim()}
        aria-invalid={!!formError && !form[key].trim()}
        aria-describedby={formError ? errId : undefined}
        onChange={(e) => setField(key, e.target.value)}
      />
    </Form.Group>
  );

  const editButton = (w) => (
    <Button
      variant="outline-primary"
      style={{ minHeight: 44, minWidth: 44 }}
      onClick={() => openEdit(w)}
      aria-label={t('admin.wards.editAria', { name: w.name })}
    >
      <i className="fas fa-edit me-1" aria-hidden="true"></i>
      {t('admin.wards.edit')}
    </Button>
  );

  return (
    <Container className="py-4">
      <div className="mb-4 d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="fas fa-map me-2 text-success" aria-hidden="true"></i>
            {t('admin.wards.title')}
          </h2>
          <p className="text-muted mb-0">{t('admin.wards.subtitle')}</p>
        </div>
        <Button variant="success" style={touch} onClick={openCreate}>
          <i className="fas fa-plus me-2" aria-hidden="true"></i>
          {t('admin.wards.add')}
        </Button>
      </div>

      <Row className="mb-4 g-3">
        {summary.map(([label, value, icon]) => (
          <Col xs={12} sm={4} key={icon}>
            <Card className="stat-card h-100">
              <Card.Body className="d-flex align-items-center">
                <div className="stat-icon me-3" aria-hidden="true">
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
            style={touch}
            type="search"
            placeholder={t('admin.wards.searchPlaceholder')}
            aria-label={t('admin.wards.searchAria')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading ? (
            <LoadingState label={t('admin.wards.loading')} variant="table" />
          ) : isError ? (
            <ErrorState message={t('admin.wards.loadFailed')} onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            wards.length === 0 ? (
              <EmptyState
                icon="map"
                title={t('admin.wards.emptyTitle')}
                text={t('admin.wards.emptyText')}
                action={{ label: t('admin.wards.emptyAction'), onClick: openCreate, icon: 'plus' }}
                className="py-4"
              />
            ) : (
              <Alert variant="info" className="mb-0">
                {t('admin.wards.noMatch')}
              </Alert>
            )
          ) : (
            <>
              <div className="table-responsive d-none d-md-block">
                <Table hover className="align-middle">
                  <caption className="visually-hidden">{t('admin.wards.title')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.wards.colWard')}</th>
                      <th scope="col">{t('admin.wards.colCity')}</th>
                      <th scope="col">{t('admin.wards.colState')}</th>
                      <th scope="col" className="text-end">{t('admin.wards.colOfficers')}</th>
                      <th scope="col" className="text-end">{t('admin.wards.colComplaints')}</th>
                      <th scope="col" className="text-end">{t('admin.wards.colActions')}</th>
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
                        <td className="text-end">{editButton(w)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <ul className="list-unstyled d-md-none mb-0">
                {filtered.map((w) => (
                  <li key={w.ward_id} className="border rounded p-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-break">{w.name}</div>
                        <div className="text-muted small text-break">
                          {w.city}, {w.state}
                        </div>
                      </div>
                      {editButton(w)}
                    </div>
                    <dl className="row small mb-0 mt-2 g-1">
                      <dt className="col-7 text-muted fw-normal">{t('admin.wards.colOfficers')}</dt>
                      <dd className="col-5 mb-0 text-end">{w.officer_count}</dd>
                      <dt className="col-7 text-muted fw-normal">{t('admin.wards.colComplaints')}</dt>
                      <dd className="col-5 mb-0 text-end">{w.complaint_count}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card.Body>
      </Card>

      <Modal
        show={showModal}
        onHide={closeModal}
        backdrop="static"
        centered
        fullscreen="sm-down"
        scrollable
        aria-labelledby="ward-modal-title"
      >
        <Form onSubmit={handleSubmit} noValidate>
          <Modal.Header closeButton={!saving} closeLabel={t('admin.wards.close')}>
            <Modal.Title as="h3" id="ward-modal-title" className="h5">
              {editing ? t('admin.wards.editTitle') : t('admin.wards.add')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && (
              <Alert variant="danger" role="alert" id={errId}>
                {formError}
              </Alert>
            )}

            {textField('wardName', 'name', t('admin.wards.fieldName'))}
            <Row>
              <Col sm={6}>{textField('wardCity', 'city', t('admin.wards.fieldCity'))}</Col>
              <Col sm={6}>{textField('wardState', 'state', t('admin.wards.fieldState'))}</Col>
            </Row>

            <fieldset className="mb-2">
              <legend className="fs-6 fw-semibold">{t('admin.wards.boundary')}</legend>
              {editing && !form.boundaryTouched && (
                <div className="text-muted small mb-2">{t('admin.wards.boundaryKept')}</div>
              )}
              <div className="d-flex flex-wrap gap-3">
                <Form.Check
                  type="radio"
                  id="mode-bbox"
                  name="boundaryMode"
                  label={t('admin.wards.modeBbox')}
                  checked={form.mode === 'bbox'}
                  onChange={() => setField('mode', 'bbox')}
                />
                <Form.Check
                  type="radio"
                  id="mode-geojson"
                  name="boundaryMode"
                  label={t('admin.wards.modeGeojson')}
                  checked={form.mode === 'geojson'}
                  onChange={() => setField('mode', 'geojson')}
                />
              </div>
            </fieldset>

            {form.mode === 'bbox' ? (
              <Row className="g-2">
                {[
                  ['south', t('admin.wards.south')],
                  ['north', t('admin.wards.north')],
                  ['west', t('admin.wards.west')],
                  ['east', t('admin.wards.east')],
                ].map(([key, label]) => (
                  <Col xs={6} key={key}>
                    <Form.Group controlId={`bbox-${key}`}>
                      <Form.Label className="small mb-1">{label}</Form.Label>
                      <Form.Control
                        type="number"
                        step="any"
                        inputMode="decimal"
                        style={touch}
                        value={form[key]}
                        onChange={(e) => setBoundaryField(key, e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                ))}
              </Row>
            ) : (
              <Form.Group controlId="wardGeojson">
                <Form.Label className="visually-hidden">{t('admin.wards.modeGeojson')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  className="font-monospace small"
                  placeholder={t('admin.wards.geojsonPlaceholder')}
                  aria-describedby="wardGeojsonHelp"
                  value={form.geojson}
                  onChange={(e) => setBoundaryField('geojson', e.target.value)}
                />
                <Form.Text id="wardGeojsonHelp" className="text-muted">
                  {t('admin.wards.geojsonHelp')}
                </Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" style={touch} onClick={closeModal} disabled={saving}>
              {t('admin.wards.cancel')}
            </Button>
            <Button type="submit" variant="success" style={touch} disabled={saving} aria-busy={saving}>
              {saving ? t('admin.wards.saving') : editing ? t('admin.wards.save') : t('admin.wards.create')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default AdminWards;
