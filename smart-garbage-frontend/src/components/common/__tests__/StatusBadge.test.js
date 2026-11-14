import { render, screen } from '@testing-library/react';
import StatusBadge, { UrgencyBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('uses the status class and humanises underscores', () => {
    render(<StatusBadge status="in_progress" />);
    const el = screen.getByText('in progress');
    expect(el).toHaveClass('badge', 'status-in_progress');
  });

  it('handles a missing status', () => {
    render(<StatusBadge status={undefined} />);
    expect(screen.getByText('unknown')).toHaveClass('badge');
  });

  it('renders unknown statuses without crashing', () => {
    render(<StatusBadge status="weird" />);
    expect(screen.getByText('weird')).toHaveClass('status-weird');
  });

  it.each(['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'])(
    'shows an aria-hidden icon plus text for %s',
    (status) => {
      const { container } = render(<StatusBadge status={status} />);
      const icon = container.querySelector('i.fa-solid');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('.badge')).toHaveTextContent(status.replace('_', ' '));
    }
  );

  it('uses distinct icons per status and a fallback for unknown', () => {
    const icons = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected', undefined].map((s) => {
      const { container, unmount } = render(<StatusBadge status={s} />);
      const cls = container.querySelector('i').className;
      unmount();
      return cls;
    });
    expect(new Set(icons).size).toBe(7);
  });
});

describe('UrgencyBadge', () => {
  it.each(['low', 'medium', 'high'])('shows icon and text for %s', (u) => {
    const { container } = render(<UrgencyBadge urgency={u} />);
    expect(container.querySelector('i[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.querySelector('.badge')).toHaveTextContent(u);
  });
});
