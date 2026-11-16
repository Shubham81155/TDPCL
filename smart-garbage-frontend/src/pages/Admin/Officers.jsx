// src/pages/Admin/Officers.jsx
import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Form, Modal, Alert, Row, Col, Card } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useTranslation } from '../../i18n/LanguageContext';
import { queryClient } from '../../queryClient';

const touch = { minHeight: 44 };

function StatusPill({ status, t }) {
  let cls = 'bg-danger';
  let icon = 'fa-circle-xmark';
  let label = status;
  if (status === 'active') {
    cls = 'bg-success';
    icon = 'fa-circle-check';
    label = t('admin.officers.statusActive');
  } else if (status === 'on_leave') {
    cls = 'bg-warning text-dark';
    icon = 'fa-clock';
    label = t('admin.officers.statusOnLeave');
  }
  return (
    <span className={`badge ${cls}`}>
      <i className={`fa-solid me-1 ${icon}`} aria-hidden="true"></i>
      {label}
    </span>
  );
}

function DeleteButton({ officer, busy, onDelete, t }) {
  return (
    <Button
      variant="outline-danger"
      style={{ minWidth: 44, minHeight: 44 }}
      disabled={busy}
      aria-label={t('admin.officers.deleteAria', { email: officer.email })}
      title={t('admin.officers.delete')}
      onClick={() => onDelete(officer)}
    >
      <i className="fas fa-trash" aria-hidden="true"></i>
    </Button>
  );
}

const emptyForm = () => ({
  email: '',
  password: '',
  employee_id: '',
  assigned_area_name: '',
  year_of_joining: new Date().getFullYear(),
});

function AdminOfficers() {
  const { t } = useTranslation();
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(emptyForm());
  const [errors, setErrors] = useState({});

  const fetchOfficers = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await apiClient.get('/officers');
      setOfficers(response.data.data || []);
    } catch (error) {
      setLoadError(true);
      toast.error(t('admin.officers.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = t('admin.officers.errEmailRequired');
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t('admin.officers.errEmailInvalid');
    if (!formData.password) newErrors.password = t('admin.officers.errPasswordRequired');
    else if (formData.password.length < 6) newErrors.password = t('admin.officers.errPasswordShort');
    if (!formData.employee_id) newErrors.employee_id = t('admin.officers.errEmployeeRequired');
    if (!formData.assigned_area_name) newErrors.assigned_area_name = t('admin.officers.errAreaRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setErrors({});
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
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

      toast.success(t('admin.officers.added'));
      setShowModal(false);
      resetForm();
      fetchOfficers();
      queryClient.invalidateQueries('admin');
      queryClient.invalidateQueries('wards');
    } catch (error) {
      toast.error(error.response?.data?.error || t('admin.officers.addFailed'));
    }
  };

  const handleDeleteOfficer = async () => {
    const officerId = pendingDelete?.officer_id;
    if (officerId == null) return;
    setDeleting(officerId);
    try {
      await apiClient.delete(`/officers/${officerId}`);
      toast.success(t('admin.officers.deleted'));
      fetchOfficers();
      queryClient.invalidateQueries('admin');
      queryClient.invalidateQueries('wards');
    } catch (error) {
      toast.error(t('admin.officers.deleteFailed'));
    } finally {
      setDeleting(null);
      setPendingDelete(null);
    }
  };

  const needle = searchTerm.toLowerCase();
  const filteredOfficers = officers.filter(
    (officer) =>
      officer.email.toLowerCase().includes(needle) ||
      officer.employee_id.includes(searchTerm) ||
      officer.assigned_area_name.toLowerCase().includes(needle)
  );

  const stats = [
    ['text-success', officers.length, t('admin.officers.total')],
    ['text-info', officers.filter((o) => o.status === 'active').length, t('admin.officers.active')],
    ['text-warning', officers.filter((o) => o.status === 'on_leave').length, t('admin.officers.onLeave')],
  ];

  const field = (name, label, props = {}) => (
    <Form.Group className="mb-3" controlId={`officer-${name}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        name={name}
        value={formData[name]}
        onChange={handleChange}
        isInvalid={!!errors[name]}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `officer-${name}-error` : undefined}
        style={touch}
        {...props}
      />
      <Form.Control.Feedback type="invalid" id={`officer-${name}-error`}>
        {errors[name]}
      </Form.Control.Feedback>
    </Form.Group>
  );

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h1 className="h2 fw-bold mb-0">
          <i className="fas fa-users me-2 text-primary" aria-hidden="true"></i>
          {t('admin.officers.title')}
        </h1>
        <Button variant="success" style={touch} onClick={() => setShowModal(true)}>
          <i className="fas fa-plus me-2" aria-hidden="true"></i>
          {t('admin.officers.add')}
        </Button>
      </div>

      <Row className="mb-4 g-3">
        {stats.map(([cls, value, label]) => (
          <Col xs={12} sm={4} key={label}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <div className={`fs-4 fw-bold ${cls}`}>{value}</div>
                <small className="text-muted">{label}</small>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Form.Control
        className="mb-3"
        style={touch}
        type="search"
        placeholder={t('admin.officers.searchPlaceholder')}
        aria-label={t('admin.officers.searchAria')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loading ? (
        <LoadingState variant="table" label={t('admin.officers.loading')} />
      ) : loadError ? (
        <ErrorState message={t('admin.officers.loadFailed')} onRetry={fetchOfficers} />
      ) : filteredOfficers.length === 0 ? (
        officers.length === 0 ? (
          <EmptyState
            icon="user-shield"
            title={t('admin.officers.emptyTitle')}
            text={t('admin.officers.emptyText')}
            action={{ label: t('admin.officers.emptyAction'), onClick: () => setShowModal(true), icon: 'plus' }}
            className="py-4"
          />
        ) : (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2" aria-hidden="true"></i>
            {t('admin.officers.noMatch')}
          </Alert>
        )
      ) : (
        <>
          <div className="table-responsive d-none d-md-block">
            <Table hover className="align-middle shadow-sm">
              <caption className="visually-hidden">{t('admin.officers.title')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.officers.colEmail')}</th>
                  <th scope="col">{t('admin.officers.colEmployeeId')}</th>
                  <th scope="col">{t('admin.officers.colArea')}</th>
                  <th scope="col">{t('admin.officers.colYear')}</th>
                  <th scope="col">{t('admin.officers.colStatus')}</th>
                  <th scope="col">{t('admin.officers.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfficers.map((officer) => (
                  <tr key={officer.officer_id}>
                    <td className="fw-bold text-break">{officer.email}</td>
                    <td>{officer.employee_id}</td>
                    <td>{officer.assigned_area_name}</td>
                    <td>{officer.year_of_joining}</td>
                    <td>
                      <StatusPill status={officer.status} t={t} />
                    </td>
                    <td>
                      <DeleteButton officer={officer} busy={deleting === officer.officer_id} onDelete={setPendingDelete} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <ul className="list-unstyled d-md-none mb-0">
            {filteredOfficers.map((officer) => (
              <li key={officer.officer_id} className="mb-3">
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="fw-bold text-break">{officer.email}</div>
                      <DeleteButton officer={officer} busy={deleting === officer.officer_id} onDelete={setPendingDelete} t={t} />
                    </div>
                    <dl className="row small mb-2 mt-2 g-1">
                      <dt className="col-5 text-muted fw-normal">{t('admin.officers.colEmployeeId')}</dt>
                      <dd className="col-7 mb-0 text-break">{officer.employee_id}</dd>
                      <dt className="col-5 text-muted fw-normal">{t('admin.officers.colArea')}</dt>
                      <dd className="col-7 mb-0 text-break">{officer.assigned_area_name}</dd>
                      <dt className="col-5 text-muted fw-normal">{t('admin.officers.colYear')}</dt>
                      <dd className="col-7 mb-0">{officer.year_of_joining}</dd>
                    </dl>
                    <StatusPill status={officer.status} t={t} />
                  </Card.Body>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal show={showModal} onHide={closeModal} centered fullscreen="sm-down" aria-labelledby="officer-modal-title">
        <Modal.Header closeButton closeLabel={t('admin.officers.close')}>
          <Modal.Title as="h3" id="officer-modal-title" className="h5">
            {t('admin.officers.modalTitle')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAddOfficer} noValidate>
            {field('email', t('admin.officers.fieldEmail'), { type: 'email', placeholder: t('admin.officers.phEmail'), autoComplete: 'off' })}
            {field('password', t('admin.officers.fieldPassword'), { type: 'password', placeholder: t('admin.officers.phPassword'), autoComplete: 'new-password' })}
            {field('employee_id', t('admin.officers.fieldEmployeeId'), { type: 'text', placeholder: t('admin.officers.phEmployeeId') })}
            {field('assigned_area_name', t('admin.officers.fieldArea'), { type: 'text', placeholder: t('admin.officers.phArea') })}
            {field('year_of_joining', t('admin.officers.fieldYear'), { type: 'number', min: '2000', max: new Date().getFullYear() })}

            <div className="d-grid gap-2">
              <Button variant="success" type="submit" style={touch}>
                {t('admin.officers.add')}
              </Button>
              <Button variant="secondary" style={touch} onClick={closeModal}>
                {t('admin.officers.cancel')}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      <ConfirmModal
        show={!!pendingDelete}
        message={t('admin.officers.confirmDelete')}
        confirmLabel={t('admin.officers.delete')}
        busy={deleting !== null}
        onConfirm={handleDeleteOfficer}
        onCancel={() => setPendingDelete(null)}
      />
    </Container>
  );
}

export default AdminOfficers;
