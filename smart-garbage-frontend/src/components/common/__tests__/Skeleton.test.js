import { render, screen } from '@testing-library/react';
import Skeleton from '../Skeleton';

describe('Skeleton', () => {
  it.each(['text', 'card', 'stat', 'table'])('renders the %s variant hidden from assistive tech', (variant) => {
    const { container } = render(<Skeleton variant={variant} />);
    expect(container.querySelector('[aria-hidden="true"] .skeleton-block')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('uses a custom label and line count', () => {
    const { container } = render(<Skeleton lines={5} label="Loading things" />);
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(5);
    expect(screen.getByText('Loading things')).toHaveClass('visually-hidden');
  });

  it('renders table rows', () => {
    const { container } = render(<Skeleton variant="table" rows={3} columns={2} />);
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(6);
  });
});
