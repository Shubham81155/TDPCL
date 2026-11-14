// src/hooks/useHeatmap.js
import { useQuery } from 'react-query';
import apiClient from '../services/api';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeHeatmap = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      count: num(r.complaint_count),
      urgent: r.has_urgent === true || r.has_urgent === 1 || r.has_urgent === '1' || r.has_urgent === 'true',
    }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.count > 0);

// filters: { dateFrom, dateTo, status, category } (empty values are omitted)
export const useHeatmap = (filters = {}) => {
  const params = {};
  ['dateFrom', 'dateTo', 'status', 'category'].forEach((k) => {
    if (filters[k]) params[k] = filters[k];
  });
  return useQuery(
    ['admin', 'heatmap', params],
    async () => normalizeHeatmap((await apiClient.get('/admin/heatmap', { params })).data?.data),
    { keepPreviousData: true }
  );
};

export const MIN_RADIUS = 6;
export const MAX_RADIUS = 30;

// Square-root scale so area (not radius) tracks the count; clamped to 6..30px.
export const radiusForCount = (count, maxCount) => {
  const c = Number(count);
  const m = Number(maxCount);
  if (!Number.isFinite(c) || !Number.isFinite(m) || c <= 0 || m <= 0) return MIN_RADIUS;
  const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(Math.min(c, m) / m);
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
};

// Fill colour by intensity (0..1): yellow -> orange -> red
export const colorForIntensity = (ratio) => {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  if (r < 0.34) return '#ffc107';
  if (r < 0.67) return '#fd7e14';
  return '#dc3545';
};

export default useHeatmap;
