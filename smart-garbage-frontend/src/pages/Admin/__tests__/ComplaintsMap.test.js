import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComplaintsMap from '../ComplaintsMap';
import { useHeatmap } from '../../../hooks/useHeatmap';
import { loadLeaflet } from '../../../utils/leafletLoader';

jest.mock('../../../utils/leafletLoader', () => ({
  __esModule: true,
  loadLeaflet: jest.fn(),
  TILE_URL: 'tiles',
  TILE_ATTRIBUTION: 'attr',
}));
jest.mock('../../../hooks/useHeatmap', () => ({
  ...jest.requireActual('../../../hooks/useHeatmap'),
  useHeatmap: jest.fn(),
}));

let map;
let markers;
const makeL = () => {
  const layer = { clearLayers: jest.fn() };
  layer.addTo = jest.fn(() => layer);
  return {
    map: jest.fn(() => {
      map = { setView: jest.fn(() => map), fitBounds: jest.fn(), remove: jest.fn() };
      return map;
    }),
    tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
    layerGroup: jest.fn(() => layer),
    circleMarker: jest.fn((latlng, opts) => {
      const m = { latlng, opts, bindTooltip: jest.fn(), addTo: jest.fn(), openTooltip: jest.fn() };
      markers.push(m);
      return m;
    }),
  };
};

const POINTS = [
  { latitude: 12.9, longitude: 77.6, count: 4, urgent: false },
  { latitude: 13.0, longitude: 77.7, count: 16, urgent: true },
];
const result = (over = {}) => ({
  data: POINTS,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  isFetching: false,
  ...over,
});

const renderMap = () =>
  render(
    <MemoryRouter initialEntries={['/admin/map']}>
      <ComplaintsMap />
    </MemoryRouter>
  );

beforeEach(() => {
  window.sessionStorage.clear();
  markers = [];
  loadLeaflet.mockResolvedValue(makeL());
  useHeatmap.mockReturnValue(result());
});

describe('ComplaintsMap', () => {
  it('draws one circle marker per point with scaled radius, urgent outline and tooltip', async () => {
    renderMap();
    await waitFor(() => expect(markers).toHaveLength(2));
    expect(markers[1].opts.radius).toBe(30);
    expect(markers[0].opts.radius).toBeCloseTo(6 + 24 * 0.5);
    expect(markers[1].opts.color).toBe('#dc3545');
    expect(markers[1].bindTooltip).toHaveBeenCalledWith('16 complaints (urgent)');
    expect(markers[0].bindTooltip).toHaveBeenCalledWith('4 complaints');
    expect(map.fitBounds).toHaveBeenCalled();
    expect(screen.getByText('Total complaints').previousSibling).toHaveTextContent('20');
    expect(screen.getByText('Urgent hotspots').previousSibling).toHaveTextContent('1');
  });

  it('zooms to a hotspot when clicked in the list', async () => {
    renderMap();
    await waitFor(() => expect(markers).toHaveLength(2));
    fireEvent.click(screen.getByText(/13\.0000, 77\.7000/));
    expect(map.setView).toHaveBeenLastCalledWith([13.0, 77.7], 16);
    expect(markers[1].openTooltip).toHaveBeenCalled();
  });

  it('passes filters to the hook', async () => {
    renderMap();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'resolved' } });
    await waitFor(() =>
      expect(useHeatmap).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'resolved' }))
    );
  });

  it('shows the empty state', async () => {
    useHeatmap.mockReturnValue(result({ data: [] }));
    renderMap();
    expect(await screen.findByText('No complaints in this range')).toBeInTheDocument();
  });

  it('shows an error with Retry', () => {
    const refetch = jest.fn();
    useHeatmap.mockReturnValue(result({ data: undefined, isError: true, refetch }));
    renderMap();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('falls back to a list when the map library fails', async () => {
    loadLeaflet.mockRejectedValue(new Error('cdn'));
    renderMap();
    expect(await screen.findByText(/map could not be loaded/i)).toBeInTheDocument();
    expect(screen.getAllByText('Open in OpenStreetMap')).toHaveLength(2);
  });
});
