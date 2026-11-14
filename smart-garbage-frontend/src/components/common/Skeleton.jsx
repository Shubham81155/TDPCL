// src/components/common/Skeleton.jsx
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import './Skeleton.css';

const Block = ({ className = '', style }) => (
  <span className={`skeleton-block ${className}`.trim()} style={style} />
);

export const SkeletonText = ({ lines = 3 }) => (
  <div>
    {Array.from({ length: lines }, (_, i) => (
      <Block key={i} className="skeleton-line" style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />
    ))}
  </div>
);

export const SkeletonCard = ({ lines = 3 }) => (
  <div className="skeleton-card">
    <Block className="skeleton-line" style={{ width: '40%', height: '1.1rem', marginBottom: '1rem' }} />
    <SkeletonText lines={lines} />
  </div>
);

export const SkeletonStatCard = () => (
  <div className="skeleton-card text-center">
    <Block className="skeleton-circle mx-auto mb-3" style={{ width: 44, height: 44 }} />
    <Block className="skeleton-line mx-auto" style={{ width: '50%' }} />
    <Block className="skeleton-line mx-auto" style={{ width: '30%', height: '1.5rem' }} />
  </div>
);

export const SkeletonTable = ({ rows = 5, columns = 5 }) => (
  <div className="skeleton-card">
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="d-flex gap-3 mb-3">
        {Array.from({ length: columns }, (_, c) => (
          <Block key={c} className="skeleton-line flex-fill" style={{ marginBottom: 0 }} />
        ))}
      </div>
    ))}
  </div>
);

/**
 * variant: 'text' | 'card' | 'stat' | 'table'. The visual part is aria-hidden; screen readers
 * get a single visually-hidden status message instead.
 */
function Skeleton({ variant = 'text', label, lines, rows, columns, className = '' }) {
  const { t } = useTranslation();
  const text = label === undefined ? t('common.loading') : label;
  let body;
  switch (variant) {
    case 'card':
      body = <SkeletonCard lines={lines} />;
      break;
    case 'stat':
      body = <SkeletonStatCard />;
      break;
    case 'table':
      body = <SkeletonTable rows={rows} columns={columns} />;
      break;
    default:
      body = <SkeletonText lines={lines} />;
  }
  return (
    <div className={className} role="status" aria-live="polite">
      <div aria-hidden="true">{body}</div>
      <span className="visually-hidden">{text}</span>
    </div>
  );
}

export default Skeleton;
