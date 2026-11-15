// src/pages/Admin/ComplaintsMap.jsx
// Complaint heatmap: one circleMarker per location (no Leaflet plugins).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Row, Col, Card, Form, ListGroup, Badge } from 'react-bootstrap';
import useDateRange from '../../hooks/useDateRange';
import DateRangeFilter from '../../components/admin/DateRangeFilter';
import { useHeatmap, radiusForCount, colorForIntensity } from '../../hooks/useHeatmap';
import { loadLeaflet, TILE_URL, TILE_ATTRIBUTION } from '../../utils/leafletLoader';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import { statusLabel, categoryLabel } from '../../i18n/labels';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

const STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];
const MAP_HEIGHT = 'clamp(280px, 50vh, 520px)';
const TAP = { minHeight: 44 };

const LEGEND = [
  { color: '#ffc107', key: 'low' },
  { color: '#fd7e14', key: 'medium' },
  { color: '#dc3545', key: 'high' },
];

function Skeleton({ label }) {
  return (
    <div className="placeholder-glow" role="status" aria-live="polite" style={{ height: MAP_HEIGHT }}>
      <span className="placeholder w-100 h-100 rounded"></span>
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

function SummaryItem({ label, value, variant }) {
  return (
    <Col xs={4}>
      <Card className="border-0 shadow-sm h-100 text-center">
        <Card.Body className="py-2 px-1">
          <div className={`fs-4 fw-bold ${variant || ''}`}>{value}</div>
          <small className="text-body-secondary">{label}</small>
        </Card.Body>
      </Card>
    </Col>
  );
}

function ComplaintsMap() {
  const { t, formatDate } = useTranslation();
  const tt = (k, p) => t(`admin.map.${k}`, p);
  const range = useDateRange();
  const tooltipText = useCallback((p) => t(p.urgent ? 'admin.map.tooltipUrgent' : 'admin.map.tooltip', { count: p.count }), [t]);
  let rangeText = tt('allTime');
  if (range.from && range.to) rangeText = `${formatDate(range.from)} - ${formatDate(range.to)}`;
  else if (range.from) rangeText = tt('dateFrom', { date: formatDate(range.from) });
  else if (range.to) rangeText = tt('dateTo', { date: formatDate(range.to) });
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
  }, [points, maxCount, mapVisible, tooltipText]);

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
      <Card.Header as="h2" className="bg-body-tertiary fw-semibold fs-6 mb-0">
        {tt('topHotspots')}
      </Card.Header>
      {hotspots.length === 0 ? (
        <Card.Body className="text-body-secondary small">{tt('noHotspots')}</Card.Body>
      ) : (
        <ListGroup variant="flush" as="ol" className="list-unstyled">
          {hotspots.map((h, i) => {
            const coords = `${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}`;
            const badges = (
              <span className="text-nowrap">
                <Badge bg="success">{h.count}</Badge>
                {h.urgent && (
                  <Badge bg="danger" className="ms-1">
                    {tt('urgent')}
                  </Badge>
                )}
              </span>
            );
            return (
              <ListGroup.Item as="li" key={`${h.latitude},${h.longitude}`} className="p-0">
                {showFallback ? (
                  <div className="d-flex justify-content-between align-items-center gap-2 px-3 py-2">
                    <span>
                      <span className="text-body-secondary me-2">{i + 1}.</span>
                      {coords}
                      <a
                        className="ms-2 small d-inline-block py-2"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.openstreetmap.org/?mlat=${h.latitude}&mlon=${h.longitude}#map=16/${h.latitude}/${h.longitude}`}
                      >
                        {tt('openOsm')}
                      </a>
                    </span>
                    {badges}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-link text-reset text-decoration-none text-start w-100 d-flex justify-content-between align-items-center gap-2 px-3 py-2 rounded-0"
                    style={TAP}
                    onClick={() => zoomTo(h)}
                  >
                    <span>
                      <span className="text-body-secondary me-2">{i + 1}.</span>
                      {coords}
                    </span>
                    {badges}
                  </button>
                )}
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}
    </Card>
  );

  return (
    <Container className="py-3 py-md-4">
      <div className="mb-3">
        <h1 className="h2 fw-bold mb-1">
          <i className="fas fa-map-marked-alt me-2 text-success" aria-hidden="true"></i>
          {tt('title')}
        </h1>
        <p className="text-body-secondary mb-0">
          {tt('subtitle')} <span className="badge text-bg-secondary">{rangeText}</span>
          <span className="ms-2 small" role="status" aria-live="polite">
            {isFetching && !isLoading ? tt('updating') : ''}
          </span>
        </p>
      </div>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-2 mb-2">
            <Col xs={12} sm={6} md={3}>
              <Form.Label htmlFor="map-status" className="small mb-1">
                {tt('status')}
              </Form.Label>
              <Form.Select id="map-status" style={TAP} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{tt('allStatuses')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(t, s)}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Label htmlFor="map-category" className="small mb-1">
                {tt('category')}
              </Form.Label>
              <Form.Select id="map-category" style={TAP} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{tt('allCategories')}</option>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {categoryLabel(t, c.value)}
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
        <ErrorState message={tt('loadFailed')} onRetry={() => refetch()} />
      ) : (
        <>
          <Row className="g-2 mb-3" role="group" aria-label={tt('summary')}>
            <SummaryItem label={tt('locations')} value={isLoading ? '-' : summary.locations} />
            <SummaryItem label={tt('totalComplaints')} value={isLoading ? '-' : summary.complaints} />
            <SummaryItem label={tt('urgentHotspots')} value={isLoading ? '-' : summary.urgent} variant="text-danger" />
          </Row>

          <Row className="g-3">
            <Col lg={8}>
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-2 position-relative">
                  {isLoading || mapState === 'loading' ? (
                    <Skeleton label={tt('loadingMap')} />
                  ) : showFallback ? (
                    <div className="p-2 p-md-3">
                      <ErrorState message={tt('mapFailed')} onRetry={() => setAttempt((a) => a + 1)} />
                      {!hasData && <EmptyState icon="map-marked-alt" message={tt('noComplaints')} />}
                    </div>
                  ) : (
                    <>
                      <div
                        ref={containerRef}
                        data-testid="heatmap-container"
                        role="application"
                        aria-label={tt('mapAria')}
                        style={{ height: MAP_HEIGHT, borderRadius: 6 }}
                      />
                      {!hasData && (
                        <div
                          className="position-absolute top-50 start-50 translate-middle bg-body rounded shadow px-3 px-md-4 py-2 w-75"
                          style={{ zIndex: 1000 }}
                        >
                          <EmptyState icon="map-marked-alt" message={tt('noComplaints')} className="py-2" />
                        </div>
                      )}
                    </>
                  )}
                  {!showFallback && (
                    <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3 small mt-2 px-1" role="group" aria-label={tt('legend')}>
                      <strong>{tt('legend')}</strong>
                      {LEGEND.map((l) => (
                        <span key={l.key} className="d-inline-flex align-items-center gap-1">
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
                          {tt(`legend_${l.key}`)}
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
                        {tt('hasUrgent')}
                      </span>
                      <span className="text-body-secondary">{tt('biggerCircle')}</span>
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
