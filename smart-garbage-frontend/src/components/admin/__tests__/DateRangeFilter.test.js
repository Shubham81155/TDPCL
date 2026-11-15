import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DateRangeFilter, { describeRangeText } from '../DateRangeFilter';

const setup = (props = {}) => {
  const setRange = jest.fn(() => '');
  const clear = jest.fn();
  render(<DateRangeFilter from="" to="" setRange={setRange} clear={clear} {...props} />);
  return { setRange, clear };
};

describe('DateRangeFilter', () => {
  it('has labelled date inputs and commits changes', () => {
    const { setRange } = setup({ from: '2026-01-01', to: '2026-01-31' });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-05' } });
    expect(setRange).toHaveBeenCalledWith('2026-01-05', '2026-01-31');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-20' } });
    expect(setRange).toHaveBeenLastCalledWith('2026-01-05', '2026-01-20');
  });

  it('presets set a range; All time sends empty values', () => {
    const { setRange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    const [from, to] = setRange.mock.calls[0];
    const days = Math.round((new Date(to) - new Date(from)) / 86400000);
    expect(days).toBe(6);
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
    fireEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(setRange.mock.calls[2][0]).toMatch(/-01$/);
    fireEvent.click(screen.getByRole('button', { name: 'All time' }));
    expect(setRange).toHaveBeenLastCalledWith('', '');
  });

  it('shows an alert when the range is invalid and Clear calls clear', () => {
    const { clear } = setup({ from: '2026-01-01', setRange: jest.fn(() => 'bad range') });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2025-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('bad range');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(clear).toHaveBeenCalled();
  });

  it('exposes a labelled group and 44px tap targets', () => {
    setup();
    expect(screen.getByRole('group', { name: 'Date range' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByLabelText('From')).toHaveStyle({ minHeight: '44px' });
  });

  it('describeRangeText formats every case via t()', () => {
    const t = (k, v = {}) => `${k}:${Object.values(v).join('|')}`;
    const fd = () => 'D';
    expect(describeRangeText(t, fd, '', '')).toBe('admin.dateRange.presets.all:');
    expect(describeRangeText(t, fd, '2026-01-01', '')).toBe('admin.dateRange.from:D');
    expect(describeRangeText(t, fd, '', '2026-01-01')).toBe('admin.dateRange.upTo:D');
    expect(describeRangeText(t, fd, '2026-01-01', '2026-01-02')).toBe('admin.dateRange.between:D|D');
  });
});
