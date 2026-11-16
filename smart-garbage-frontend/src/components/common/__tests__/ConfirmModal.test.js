import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../ConfirmModal';

describe('ConfirmModal', () => {
  it('renders nothing when hidden', () => {
    render(<ConfirmModal show={false} message="Sure?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText('Sure?')).not.toBeInTheDocument();
  });

  it('calls onConfirm / onCancel from the matching buttons', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<ConfirmModal show message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Sure?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while busy', () => {
    render(<ConfirmModal show busy message="m" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
