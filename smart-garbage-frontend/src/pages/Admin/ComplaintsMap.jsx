// src/pages/Admin/ComplaintsMap.jsx
// Complaint heatmap: one circleMarker per location (no Leaflet plugins).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Row, Col, Card, Form, ListGroup, Badge } from 'react-bootstrap';
import useDateRange, { describeRange } from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import { useHeatmap, radiusForCount, colorForIntensity } from '../../hooks/useHeatmap';
import { loadLeaflet, TILE_URL, TILE_ATTRIBUTION } from '../../utils/leafletLoader';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

const STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];
const statusLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const tooltipText = (p) => `${p.count} complaints${p.urgent ? ' (urgent)' : ''}`;
const MAP_HEIGHT = 'clamp(320px, 55vh, 520px)';

const LEGEND = [
  { color: '#ffc107', label: 'Low' },
  { color: '#fd7e14', label: 'Medium' },
  { color: '#dc3545', label: 'High' },
];

function Skeleton() {
  return (
    <div className="placeholder-glow" role="status" aria-live="polite" style={{ height: MAP_HEIGHT }}>
      <span className="placeholder w-100 h-100 rounded"></span>
      <span className="visually-hidden">Loading map data</span>
    </div>
  );
}

function SummaryItem({ label, value, variant }) {
  return (
    <Col xs={4}>
      <Card className="border-0 shadow-sm h-100 text-center">
        <Card.Body className="py-2 px-1">
          <div className={`fs-4 fw-bold ${variant || ''}`}>{value}</div>
          <small className="text-muted">{label}</small>
        </Card.Body>
      </Card>
    </Col>
  );
}

function ComplaintsMap() {
  const range = useDateRange();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const { data, isLoading, isError, refetch, isFetching } = useHeatmap({
    ...range.params,
    status,
    category,
  });
  const points = useMemo(() => data || [], [data]);

  const [mapState, setMapState] = useState('loading'); // loading | ready | failed
  const [attempt, setAttempt] = useState(0);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef([]);
  const leafletRef = useRef(null);

  const summary = useMemo(
    () => ({
      locations: points.length,
      complaints: points.reduce((a, p) => a + p.count, 0),
      urgent: points.filter((p) => p.urgent).length,
    }),
    [points]
  );
  const maxCount = useMemo(() => points.reduce((m, p) => Math.max(m, p.count), 0), [points]);
  const hotspots = useMemo(
    () =>
      points
        .map((p, index) => ({ ...p, index }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    [points]
  );

  useEffect(() => {
    let active = true;
    setMapState('loading');
    loadLeaflet()
      .then((L) => {
        if (!active) return;
        leafletRef.current = L;
        setMapState('ready');
      })
      .catch(() => {
        if (active) setMapState('failed');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const mapVisible = mapState === 'ready' && !isLoading && !(isError && points.length === 0);

  // Create the map when its container is on screen
  useEffect(() => {
    if (!mapVisible || !containerRef.current) return undefined;
    const L = leafletRef.current;
    const map = L.map(containerRef.current).setView([20.59, 78.96], 5);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = [];
    };
  }, [mapVisible]);

  // Draw the points
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!mapVisible || !L || !map || !layer) return;
    layer.clearLayers();
    markersRef.current = points.map((p) => {
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: radiusForCount(p.count, maxCount),
        fillColor: colorForIntensity(maxCount ? p.count / maxCount : 0),
        fillOpacity: 0.65,
        color: p.urgent ? '#dc3545' : '#6c757d',
        weight: p.urgent ? 3 : 1,
      });
      marker.bindTooltip(tooltipText(p));
      marker.addTo(layer);
      return marker;
    });
    if (points.length) {
      map.fitBounds(
        points.map((p) => [p.latitude, p.longitude]),
        { padding: [30, 30], maxZoom: 15 }
      );
    }
  }, [points, maxCount, mapVisible]);

  const zoomTo = useCallback((h) => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([h.latitude, h.longitude], 16);
    const marker = markersRef.current[h.index];
    if (marker && marker.openTooltip) marker.openTooltip();
    if (containerRef.current && containerRef.current.scrollIntoView) {
      containerRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const hasData = points.length > 0;
  const showFallback = mapState === 'failed';

  const hotspotList = (
    <Card className="border-0 shadow-sm">
      <Card.Header className="bg-body-tertiary fw-semibold">Top hotspots</Card.Header>
      {hotspots.length === 0 ? (
        <Card.Body className="text-muted small">No hotspots to show.</Card.Body>
      ) : (
        <ListGroup variant="flush" as="ol">
          {hotspots.map((h, i) => (
            <ListGroup.Item
              as="li"
              key={`${h.latitude},${h.longitude}`}
              action={!showFallback}
              onClick={showFallback ? undefined : () => zoomTo(h)}
              className="d-flex justify-content-between align-items-center gap-2"
            >
              <span>
                <span className="text-muted me-2">{i + 1}.</span>
                {h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}
                {showFallback && (
                  <a
                    className="ms-2 small"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${h.latitude}&mlon=${h.longitude}#map=16/${h.latitude}/${h.longitude}`}
                  >
                    Open in OpenStreetMap
                  </a>
                )}
              </span>
              <span className="text-nowrap">
                <Badge bg="success">{h.count}</Badge>
                {h.urgent && (
                  <Badge bg="danger" className="ms-1">
                    urgent
                  </Badge>
                )}
              </span>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Card>
  );

  return (
    <Container className="py-4">
      <div className="mb-3">
        <h2 className="fw-bold mb-1">
          <i className="fas fa-map-marked-alt me-2 text-success" aria-hidden="true"></i>
          Complaint Map
        </h2>
        <p className="text-muted mb-0">
          Where complaints are concentrated.{' '}
          <span className="badge text-bg-secondary">{describeRange(range.from, range.to)}</span>
          {isFetching && !isLoading && <span className="ms-2 small">Updating...</span>}
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-2 mb-2">
            <Col xs={6} md={3}>
              <Form.Label htmlFor="map-status" className="small mb-1">
                Status
              </Form.Label>
              <Form.Select id="map-status" size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6} md={3}>
              <Form.Label htmlFor="map-category" className="small mb-1">
                Category
              </Form.Label>
              <Form.Select
                id="map-category"
                size="sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>
          <DateRangeFilter
            idPrefix="map-range"
            from={range.from}
            to={range.to}
            setRange={range.setRange}
            clear={range.clear}
          />
        </Card.Body>
      </Card>

      {isError && !hasData ? (
        <ErrorState message="Failed to load map data." onRetry={() => refetch()} />
      ) : (
        <>
          <Row className="g-2 mb-3" aria-label="Summary">
            <SummaryItem label="Locations" value={isLoading ? '-' : summary.locations} />
            <SummaryItem label="Total complaints" value={isLoading ? '-' : summary.complaints} />
            <SummaryItem label="Urgent hotspots" value={isLoading ? '-' : summary.urgent} variant="text-danger" />
          </Row>

          <Row className="g-3">
            <Col lg={8}>
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-2 position-relative">
                  {isLoading || mapState === 'loading' ? (
                    <Skeleton />
                  ) : showFallback ? (
                    <div className="p-3">
                      <ErrorState
                        message="The map could not be loaded. Showing the hotspot list instead."
                        onRetry={() => setAttempt((a) => a + 1)}
                      />
                      {!hasData && <EmptyState icon="map-marked-alt" message="No complaints in this range" />}
                    </div>
                  ) : (
                    <>
                      <div
                        ref={containerRef}
                        data-testid="heatmap-container"
                        role="application"
                        aria-label="Complaint heatmap"
                        style={{ height: MAP_HEIGHT, borderRadius: 6 }}
                      />
                      {!hasData && (
                        <div
                          className="position-absolute top-50 start-50 translate-middle bg-body rounded shadow px-4 py-2"
                          style={{ zIndex: 1000 }}
                        >
                          <EmptyState icon="map-marked-alt" message="No complaints in this range" />
                        </div>
                      )}
                    </>
                  )}
                  {!showFallback && (
                    <div className="d-flex flex-wrap align-items-center gap-3 small mt-2 px-1" aria-label="Legend">
                      <strong>Legend</strong>
                      {LEGEND.map((l) => (
                        <span key={l.label} className="d-inline-flex align-items-center gap-1">
                          <span
                            aria-hidden="true"
                            style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: l.color,
                              border: '1px solid #6c757d',
                            }}
                          ></span>
                          {l.label}
                        </span>
                      ))}
                      <span className="d-inline-flex align-items-center gap-1">
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '3px solid #dc3545',
                          }}
                        ></span>
                        Has urgent
                      </span>
                      <span className="text-muted">Bigger circle = more complaints</span>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col lg={4}>{hotspotList}</Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default ComplaintsMap;
