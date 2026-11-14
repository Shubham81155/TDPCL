// src/components/common/EmptyState.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

/**
 * Guided empty state. `message` is kept for backwards compatibility (alias of `text`).
 * `action`: { label, to } renders a link button, { label, onClick } a button.
 */
// No built-in strings: callers pass already-translated title/text/action labels.
function EmptyState({ icon = 'inbox', title, text, message, action, children, className = 'py-5' }) {
  const body = text || message;
  const content = action && (
    <>
      {action.icon && <i className={`fas fa-${action.icon} me-2`} aria-hidden="true"></i>}
      {action.label}
    </>
  );
  return (
    <div className={`text-center ${className}`}>
      <i className={`fas fa-${icon} fa-2x text-muted mb-2 d-block`} aria-hidden="true"></i>
      {title && <h5 className="fw-bold mb-1">{title}</h5>}
      {body && <p className="text-muted mb-3">{body}</p>}
      {action &&
        (action.to ? (
          <Button as={Link} to={action.to} variant={action.variant || 'success'} size={action.size}>
            {content}
          </Button>
        ) : (
          <Button type="button" variant={action.variant || 'success'} size={action.size} onClick={action.onClick}>
            {content}
          </Button>
        ))}
      {children}
    </div>
  );
}

export default EmptyState;
