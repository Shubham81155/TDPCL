// src/components/admin/DateRangeFilter.jsx
import React, { useEffect, useState } from 'react';
import { Form, Button } from 'react-bootstrap';

const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PRESETS = [
  {
    key: 'last7',
    label: 'Last 7 days',
    range: (now) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return [toISODate(from), toISODate(now)];
    },
  },
  {
    key: 'last30',
    label: 'Last 30 days',
    range: (now) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return [toISODate(from), toISODate(now)];
    },
  },
  {
    key: 'month',
    label: 'This month',
    range: (now) => [toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), toISODate(now)],
  },
  { key: 'all', label: 'All time', range: () => ['', ''] },
];

/**
 * Controlled by the values returned from useDateRange().
 * props: from, to, setRange(from, to) => errorMessage|'' , clear()
 */
function DateRangeFilter({ from, to, setRange, clear, idPrefix = 'range' }) {
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
    <div className="date-range-filter" role="group" aria-label="Date range">
      <div className="row g-2 align-items-end">
        <div className="col-6 col-sm-auto">
          <Form.Label htmlFor={`${idPrefix}-from`} className="small mb-1">
            From
          </Form.Label>
          <Form.Control
            id={`${idPrefix}-from`}
            type="date"
            size="sm"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => commit(e.target.value, draftTo)}
            isInvalid={!!error}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
          />
        </div>
        <div className="col-6 col-sm-auto">
          <Form.Label htmlFor={`${idPrefix}-to`} className="small mb-1">
            To
          </Form.Label>
          <Form.Control
            id={`${idPrefix}-to`}
            type="date"
            size="sm"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => commit(draftFrom, e.target.value)}
            isInvalid={!!error}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
          />
        </div>
        <div className="col-12 col-sm d-flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={activePreset?.key === p.key ? 'success' : 'outline-secondary'}
              aria-pressed={activePreset?.key === p.key}
              onClick={() => {
                const [f, t] = p.range(new Date());
                commit(f, t);
              }}
            >
              {p.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="link"
            className="text-decoration-none"
            onClick={() => {
              setError('');
              clear();
            }}
            disabled={!from && !to && !draftFrom && !draftTo}
          >
            Clear
          </Button>
        </div>
      </div>
      {error && (
        <div id={`${idPrefix}-error`} className="text-danger small mt-1" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export default DateRangeFilter;
