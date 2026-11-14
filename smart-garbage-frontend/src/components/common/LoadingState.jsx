// src/components/common/LoadingState.jsx
import React from 'react';
import { Spinner, Row, Col } from 'react-bootstrap';
import { useTranslation } from '../../i18n/LanguageContext';
import { SkeletonStatCard, SkeletonCard, SkeletonTable } from './Skeleton';

const SKELETON_VARIANTS = ['cards', 'table', 'detail'];

/**
 * variant: 'cards' | 'table' | 'detail' render skeletons; anything else (default 'success',
 * kept for backwards compatibility) is a Bootstrap colour for the legacy spinner.
 */
function LoadingState({ label, variant = 'success', fullPage = false }) {
  const { t } = useTranslation();
  const text = label === undefined ? t('common.loading') : label;
  const isSkeleton = SKELETON_VARIANTS.includes(variant);
  let body;
  if (variant === 'cards') {
    body = (
      <Row className="g-3">
        {[0, 1, 2, 3].map((i) => (
          <Col md={3} xs={6} key={i}>
            <SkeletonStatCard />
          </Col>
        ))}
      </Row>
    );
  } else if (variant === 'table') {
    body = <SkeletonTable rows={6} columns={5} />;
  } else if (variant === 'detail') {
    body = (
      <Row className="g-3">
        <Col lg={8}>
          <SkeletonCard lines={6} />
        </Col>
        <Col lg={4}>
          <SkeletonCard lines={4} />
        </Col>
      </Row>
    );
  }

  return (
    <div
      className={isSkeleton ? 'py-3' : 'text-center py-5 d-flex justify-content-center align-items-center'}
      style={fullPage ? { minHeight: '50vh' } : undefined}
      role="status"
      aria-live="polite"
    >
      {isSkeleton ? <div aria-hidden="true">{body}</div> : <Spinner animation="border" variant={variant} />}
      <span className="visually-hidden">{text}</span>
    </div>
  );
}

export default LoadingState;
