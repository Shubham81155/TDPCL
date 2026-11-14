// src/pages/Officer/Map.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Container, Alert, Card, Spinner, ListGroup } from 'react-bootstrap';
import apiClient from '../../services/api';
import toast from 'react-hot-toast';

const ACTIVE_COMPLAINT_STATUSES = new Set(['new', 'assigned', 'pending', 'in_progress']);

function OfficerMap() {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const mapInstanceRef = useRef(null);
  const mapElementRef = useRef(null);
  const markerRefs = useRef(new Map());

  useEffect(() => {
    const loadAssignedComplaints = async () => {
      try {
        const response = await apiClient.get('/complaints/officer/assigned');
        setComplaints(response.data.data || []);
      } catch (error) {
        toast.error('Failed to load map data');
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignedComplaints();
  }, []);

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
    const leafletCssId = 'leaflet-css';
    if (!document.getElementById(leafletCssId)) {
      const link = document.createElement('link');
      link.id = leafletCssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (window.L) {
      setMapReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setMapReady(true);
    script.onerror = () => toast.error('Failed to load map library');
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapElementRef.current || !validLocations.length || !window.L) {
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = window.L.map(mapElementRef.current);
    mapInstanceRef.current = map;
    markerRefs.current = new Map();

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const markerBounds = [];
    validLocations.forEach((complaint) => {
      const marker = window.L.marker([complaint.latitude, complaint.longitude]).addTo(map);
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
  }, [mapReady, validLocations]);

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
    return Number.isFinite(numeric) ? numeric.toFixed(4) : 'N/A';
  };

  return (
    <Container className="py-4">
      <h2 className="fw-bold mb-4">
        <i className="fas fa-map-marked-alt me-2 text-primary"></i>
        Complaints Map
      </h2>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : validLocations.length === 0 ? (
        <Alert variant="info">
          <i className="fas fa-info-circle me-2"></i>
          No complaint locations available to display on map.
        </Alert>
      ) : (
        <>
          <Alert variant="info">
            <i className="fas fa-map me-2"></i>
            Only current unresolved complaints are pinned on this map.
          </Alert>

          <Card className="border-0 shadow-sm mb-3">
            <Card.Body className="p-2">
              <div
                ref={mapElementRef}
                style={{ width: '100%', height: '500px', borderRadius: '6px' }}
              />
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light fw-bold">Current Issues Coordinates</Card.Header>
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
