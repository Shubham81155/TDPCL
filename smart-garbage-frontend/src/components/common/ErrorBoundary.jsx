// src/components/common/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
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

    return (
      <div className="container py-5 text-center" role="alert">
        <h2 className="fw-bold mb-2">Something went wrong</h2>
        <p className="text-muted mb-4">
          An unexpected error occurred. You can reload the page or head back to your dashboard.
        </p>
        <button type="button" className="btn btn-success me-2" onClick={() => window.location.reload()}>
          Reload page
        </button>
        <a className="btn btn-outline-secondary" href="/">
          Go to dashboard
        </a>
      </div>
    );
  }
}

export default ErrorBoundary;
