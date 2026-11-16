// src/pages/Officer/Map.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Container, Alert, Card, Button, ListGroup } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';
import { loadLeaflet, TILE_URL, TILE_ATTRIBUTION } from '../../utils/leafletLoader';
import { useTranslation } from '../../i18n/LanguageContext';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import Skeleton from '../../components/common/Skeleton';

const ACTIVE_COMPLAINT_STATUSES = new Set(['new', 'assigned', 'pending', 'in_progress']);

function OfficerMap() {
  const { t } = useTranslation();
  // The load effect runs once on mount; read t through a ref so it never re-fetches on a language switch.
  const tRef = useRef(t);
  tRef.current = t;
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [leaflet, setLeaflet] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const mapInstanceRef = useRef(null);
  const mapElementRef = useRef(null);
  const markerRefs = useRef(new Map());

  useEffect(() => {
    const loadAssignedComplaints = async () => {
      setLoadError(false);
      try {
        const response = await apiClient.get('/complaints/officer/assigned');
        setComplaints(response.data.data || []);
      } catch (error) {
        toast.error(tRef.current('officer.map.loadFailed'));
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignedComplaints();
  }, [loadAttempt]);

  const validLocations = useMemo(() => {
    return complaints
      .filter((complaint) => ACTIVE_COMPLAINT_STATUSES.has(complaint.status))
      .map((complaint) => ({
        ...complaint,
        latitude: Number(complaint.latitude),
        longitude: Number(complaint.longitude),
      }))
      .filter(
        (complaint) =>
          Number.isFinite(complaint.latitude) && Number.isFinite(complaint.longitude)
      );
  }, [complaints]);

  useEffect(() => {
    let cancelled = false;
    setMapError(false);
    loadLeaflet()
      .then((L) => {
        if (!cancelled) setLeaflet(L);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mapAttempt]);

  useEffect(() => {
    if (!leaflet || !mapElementRef.current || !validLocations.length) {
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = leaflet.map(mapElementRef.current);
    mapInstanceRef.current = map;
    markerRefs.current = new Map();

    leaflet.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);

    const markerBounds = [];
    validLocations.forEach((complaint) => {
      const marker = leaflet.marker([complaint.latitude, complaint.longitude]).addTo(map);
      marker.bindPopup(`#${complaint.complaint_id} - ${complaint.title}`);
      marker.on('click', () => setSelectedComplaintId(complaint.complaint_id));
      markerRefs.current.set(complaint.complaint_id, marker);
      markerBounds.push([complaint.latitude, complaint.longitude]);
    });

    if (markerBounds.length === 1) {
      map.setView(markerBounds[0], 15);
    } else {
      map.fitBounds(markerBounds, { padding: [30, 30] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRefs.current = new Map();
    };
  }, [leaflet, validLocations]);

  const focusComplaintOnMap = (complaint) => {
    const map = mapInstanceRef.current;
    const marker = markerRefs.current.get(complaint.complaint_id);

    if (!map || !marker) {
      return;
    }

    map.setView([complaint.latitude, complaint.longitude], 16, { animate: true });
    marker.openPopup();
    setSelectedComplaintId(complaint.complaint_id);
  };

  const formatCoordinate = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(4) : t('common.na');
  };

  return (
    <Container className="py-4">
      <h1 className="h2 fw-bold mb-4">
        <i className="fas fa-map-marked-alt me-2 text-primary"></i>
        {t('officer.map.title')}
      </h1>

      {isLoading ? (
        <LoadingState variant="table" label={t('officer.map.loading')} />
      ) : loadError ? (
        <ErrorState
          message={t('officer.map.loadFailed')}
          onRetry={() => { setIsLoading(true); setLoadAttempt((n) => n + 1); }}
        />
      ) : validLocations.length === 0 ? (
        <Alert variant="info">
          <i className="fas fa-info-circle me-2"></i>
          {t('officer.map.noLocations')}
        </Alert>
      ) : (
        <>
          <Alert variant="info">
            <i className="fas fa-map me-2"></i>
            {t('officer.map.onlyUnresolved')}
          </Alert>

          <Card className="border-0 shadow-sm mb-3">
            <Card.Body className="p-2">
              {mapError ? (
                <div className="text-center py-5" role="alert">
                  <i className="fas fa-map-marked-alt fa-2x text-muted mb-2 d-block" aria-hidden="true"></i>
                  <p className="fw-bold mb-1">{t('common.mapCouldNotLoad')}</p>
                  <p className="text-muted small">{t('officer.map.libError')}</p>
                  <Button variant="outline-primary" size="sm" onClick={() => setMapAttempt((n) => n + 1)}>
                    <i className="fas fa-redo me-1" aria-hidden="true"></i>{t('common.retry')}
                  </Button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div
                    ref={mapElementRef}
                    style={{ width: '100%', height: '500px', borderRadius: '6px' }}
                  />
                  {!leaflet && (
                    <div style={{ position: 'absolute', inset: 0 }} className="p-3">
                      <Skeleton variant="card" lines={8} label={t('officer.map.loadingMap')} />
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Header className="fw-bold">{t('officer.map.coordsTitle')}</Card.Header>
            <ListGroup variant="flush">
              {validLocations.map((complaint) => (
                <ListGroup.Item
                  key={complaint.complaint_id}
                  action
                  active={selectedComplaintId === complaint.complaint_id}
                  onClick={() => focusComplaintOnMap(complaint)}
                  className="d-flex justify-content-between align-items-center"
                >
                  <span>#{complaint.complaint_id} - {complaint.title}</span>
                  <span className="text-muted small">
                    {formatCoordinate(complaint.latitude)}, {formatCoordinate(complaint.longitude)}
                  </span>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </>
      )}
    </Container>
  );
}

export default OfficerMap;
