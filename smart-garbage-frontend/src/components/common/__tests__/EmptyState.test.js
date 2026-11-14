import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and text, and supports the legacy message prop', () => {
    const { rerender } = render(<EmptyState title="Nothing" text="Add something" />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.getByText('Add something')).toBeInTheDocument();
    rerender(<EmptyState message="legacy" />);
    expect(screen.getByText('legacy')).toBeInTheDocument();
  });

  it('renders a link action', () => {
    render(
      <MemoryRouter>
        <EmptyState title="t" action={{ label: 'Go', to: '/somewhere' }} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('href', '/somewhere');
  });

  it('renders a button action', () => {
    const onClick = jest.fn();
    render(<EmptyState title="t" action={{ label: 'Add', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('has no action when none is given', () => {
    render(<EmptyState title="t" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
