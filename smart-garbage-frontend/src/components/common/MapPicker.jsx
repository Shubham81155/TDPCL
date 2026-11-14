// src/components/common/MapPicker.jsx
// Tap-to-place / drag-to-adjust location picker built on Leaflet (loaded from the CDN).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { loadLeaflet, TILE_URL, TILE_ATTRIBUTION } from '../../utils/leafletLoader';
import { useTranslation } from '../../i18n/LanguageContext';
import './MapPicker.css';

const INDIA_CENTER = [20.59, 78.96];
const INDIA_ZOOM = 5;
const PIN_ZOOM = 16;
const GEO_TIMEOUT_MS = 10000;

const round = (n) => Math.round(n * 1e6) / 1e6;

function MapPicker({ value, onChange, height }) {
  const { t } = useTranslation();
  // The Leaflet marker is created inside an effect; read t through a ref so a language
  // switch never rebuilds the map or moves the pin.
  const tRef = useRef(t);
  tRef.current = t;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const lastEmittedRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const geoRequestRef = useRef(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');

  onChangeRef.current = onChange;
  valueRef.current = value;

  const emit = useCallback((lat, lng) => {
    const point = { lat: round(lat), lng: round(lng) };
    lastEmittedRef.current = point;
    if (onChangeRef.current) onChangeRef.current(point);
  }, []);

  // Load Leaflet and build the map.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        const initial = valueRef.current;
        const center = initial ? [initial.lat, initial.lng] : INDIA_CENTER;
        const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
          center,
          initial ? PIN_ZOOM : INDIA_ZOOM
        );
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        map.on('click', (e) => emit(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;
        leafletRef.current = L;
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [attempt, emit]);

  // Keep the marker in sync with `value`.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    const L = leafletRef.current;
    if (!value) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    const latlng = [value.lat, value.lng];
    if (!markerRef.current) {
      const marker = L.marker(latlng, {
        draggable: true,
        keyboard: true,
        title: tRef.current('common.mapPicker.pinTitle'),
        alt: tRef.current('common.mapPicker.pinAlt'),
      }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        emit(p.lat, p.lng);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latlng);
    }
    const last = lastEmittedRef.current;
    const fromMap = last && last.lat === value.lat && last.lng === value.lng;
    if (!fromMap && map.panTo) map.panTo(latlng);
  }, [value, status, emit]);

  const useMyLocation = () => {
    setGeoMessage('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMessage('unavailable');
      return;
    }
    const requestId = ++geoRequestRef.current;
    setLocating(true);
    const fail = () => {
      if (geoRequestRef.current !== requestId) return;
      geoRequestRef.current++;
      setLocating(false);
      setGeoMessage('unavailable');
    };
    // Browsers do not count the permission prompt towards `timeout`, so guard it ourselves.
    const guard = setTimeout(fail, GEO_TIMEOUT_MS + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(guard);
        if (geoRequestRef.current !== requestId) return;
        geoRequestRef.current++;
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        emit(latitude, longitude);
        if (mapRef.current) mapRef.current.setView([latitude, longitude], PIN_ZOOM);
      },
      () => {
        clearTimeout(guard);
        fail();
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 60000 }
    );
  };

  // Ignore late geolocation results after unmount.
  useEffect(
    () => () => {
      geoRequestRef.current++;
    },
    []
  );

  const frameStyle = height ? { height } : undefined;

  return (
    <div className="map-picker">
      <div className="map-picker__frame" style={frameStyle}>
        {status === 'error' ? (
          <div className="map-picker__error" role="alert">
            <span>{t('common.mapCouldNotLoad')}</span>
            <Button variant="outline-secondary" onClick={() => setAttempt((n) => n + 1)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="map-picker__canvas"
              role="application"
              aria-label={t('common.mapPicker.mapAria')}
            />
            {status === 'loading' && (
              <div className="map-picker__overlay" role="status">
                <Spinner size="sm" className="me-2" /> {t('common.mapPicker.loadingMap')}
              </div>
            )}
            {status === 'ready' && !value && (
              <div className="map-picker__hint">{t('common.mapPicker.hint')}</div>
            )}
          </>
        )}
      </div>

      <Button
        variant="outline-success"
        className="map-picker__locate w-100 mt-2"
        onClick={useMyLocation}
        disabled={locating}
        aria-label={t('common.mapPicker.useMyLocation')}
      >
        {locating ? (
          <>
            <Spinner size="sm" className="me-2" /> {t('common.mapPicker.finding')}
          </>
        ) : (
          <>
            <i className="fas fa-location-crosshairs me-2" aria-hidden="true"></i>
            {t('common.mapPicker.useMyLocation')}
          </>
        )}
      </Button>

      {geoMessage && (
        <div className="text-warning-emphasis small mt-2" role="status">
          {t('common.mapPicker.unavailable')}
        </div>
      )}

      <div className="text-muted small mt-2" data-testid="map-picker-coords">
        {value
          ? t('common.mapPicker.chosen', { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })
          : t('common.mapPicker.none')}
      </div>
    </div>
  );
}

export default MapPicker;
