// src/components/admin/DateRangeFilter.jsx
import React, { useEffect, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import { useTranslation } from '../../i18n/LanguageContext';

const TAP = { minHeight: 44, minWidth: 44 };
const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PRESETS = [
  {
    key: 'last7',
    range: (now) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return [toISODate(from), toISODate(now)];
    },
  },
  {
    key: 'last30',
    range: (now) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return [toISODate(from), toISODate(now)];
    },
  },
  {
    key: 'month',
    range: (now) => [toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), toISODate(now)],
  },
  { key: 'all',  range: () => ['', ''] },
];

// Human text for the active range ("All time", "From 1 Jan", ...), translated.
export const describeRangeText = (t, formatDate, from, to) => {
  const fmt = (v) => formatDate(new Date(`${v}T00:00:00`));
  if (from && to) return t('admin.dateRange.between', { from: fmt(from), to: fmt(to) });
  if (from) return t('admin.dateRange.from', { date: fmt(from) });
  if (to) return t('admin.dateRange.upTo', { date: fmt(to) });
  return t('admin.dateRange.presets.all');
};

/**
 * Controlled by the values returned from useDateRange().
 * props: from, to, setRange(from, to) => errorMessage|'' , clear()
 */
function DateRangeFilter({ from, to, setRange, clear, idPrefix = 'range' }) {
  const { t } = useTranslation();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
    setError('');
  }, [from, to]);

  const commit = (f, t) => {
    setDraftFrom(f);
    setDraftTo(t);
    setError(setRange(f, t));
  };

  const activePreset = PRESETS.find((p) => {
    const [f, t] = p.range(new Date());
    return f === from && t === to;
  });

  return (
    <div className="date-range-filter" role="group" aria-label={t('admin.dateRange.group')}>
      <div className="row g-2 align-items-end">
        <div className="col-6 col-sm-auto">
          <Form.Label htmlFor={`${idPrefix}-from`} className="small mb-1">
            {t('admin.dateRange.fromLabel')}
          </Form.Label>
          <Form.Control
            id={`${idPrefix}-from`}
            type="date"
            style={{ minHeight: 44 }}
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => commit(e.target.value, draftTo)}
            isInvalid={!!error}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
          />
        </div>
        <div className="col-6 col-sm-auto">
          <Form.Label htmlFor={`${idPrefix}-to`} className="small mb-1">
            {t('admin.dateRange.toLabel')}
          </Form.Label>
          <Form.Control
            id={`${idPrefix}-to`}
            type="date"
            style={{ minHeight: 44 }}
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => commit(draftFrom, e.target.value)}
            isInvalid={!!error}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
          />
        </div>
        <div className="col-12 col-sm d-flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              className="px-3"
              style={TAP}
              variant={activePreset?.key === p.key ? 'success' : 'outline-secondary'}
              aria-pressed={activePreset?.key === p.key}
              onClick={() => {
                const [f, t] = p.range(new Date());
                commit(f, t);
              }}
            >
              {t(`admin.dateRange.presets.${p.key}`)}
            </Button>
          ))}
          <Button
            variant="link"
            className="text-decoration-none"
            style={TAP}
            onClick={() => {
              setError('');
              clear();
            }}
            disabled={!from && !to && !draftFrom && !draftTo}
          >
            {t('admin.dateRange.clear')}
          </Button>
        </div>
      </div>
      {error && (
        <div id={`${idPrefix}-error`} className="text-danger-emphasis small mt-1" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export default DateRangeFilter;
