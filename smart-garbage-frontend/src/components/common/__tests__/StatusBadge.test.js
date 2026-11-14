import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

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
});
