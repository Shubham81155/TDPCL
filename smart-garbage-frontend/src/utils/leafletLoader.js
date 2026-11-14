// src/utils/leafletLoader.js
// Loads Leaflet (CSS + JS) from the CDN exactly once and shares the promise, so every
// map in the app (officer map, citizen location picker, admin map) uses the same copy.

const LEAFLET_VERSION = '1.9.4';
const CSS_ID = 'leaflet-css';
const SCRIPT_ID = 'leaflet-js';
const BASE = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

let loadPromise = null;

/**
 * Resolves with the global `L` once Leaflet is ready; rejects if the CDN is unreachable.
 * Safe to call from several components at the same time.
 */
export const loadLeaflet = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet needs a browser'));
  }
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;

  if (!document.getElementById(CSS_ID)) {
    const link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = `${BASE}/leaflet.css`;
    document.head.appendChild(link);
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `${BASE}/leaflet.js`;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      loadPromise = null; // allow a retry
      script.remove();
      reject(new Error('Failed to load map library'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
};

export default loadLeaflet;
