// src/components/common/ErrorBoundary.jsx
import React from 'react';
import LanguageContext from '../../i18n/LanguageContext';

class ErrorBoundary extends React.Component {
  static contextType = LanguageContext;

  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { t } = this.context;
    return (
      <div className="container py-5 text-center" role="alert">
        <h1 className="h2 fw-bold mb-2">{t('common.errorBoundary.title')}</h1>
        <p className="text-muted mb-4">{t('common.errorBoundary.text')}</p>
        <button type="button" className="btn btn-success me-2" onClick={() => window.location.reload()}>
          {t('common.errorBoundary.reload')}
        </button>
        <a className="btn btn-outline-secondary" href="/">
          {t('common.errorBoundary.goDashboard')}
        </a>
      </div>
    );
  }
}

export default ErrorBoundary;
