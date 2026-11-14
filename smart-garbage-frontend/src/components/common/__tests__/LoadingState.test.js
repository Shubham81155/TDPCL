import { render, screen } from '@testing-library/react';
import LoadingState from '../LoadingState';

describe('LoadingState', () => {
  it('defaults to a spinner', () => {
    const { container } = render(<LoadingState label="Loading wards" />);
    expect(container.querySelector('.spinner-border')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading wards');
  });

  it('keeps a colour passed as variant working for the spinner', () => {
    const { container } = render(<LoadingState variant="primary" />);
    expect(container.querySelector('.spinner-border.text-primary')).toBeInTheDocument();
  });

  it.each(['cards', 'table', 'detail'])('renders skeletons for %s', (variant) => {
    const { container } = render(<LoadingState variant={variant} label="Please wait" />);
    expect(container.querySelector('.spinner-border')).not.toBeInTheDocument();
    expect(container.querySelector('.skeleton-block')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Please wait');
  });
});
