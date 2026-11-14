// src/components/common/__tests__/MapPicker.test.js
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MapPicker from '../MapPicker';
import { loadLeaflet } from '../../../utils/leafletLoader';

jest.mock('../../../utils/leafletLoader', () => ({
  __esModule: true,
  loadLeaflet: jest.fn(),
  TILE_URL: 'tiles',
  TILE_ATTRIBUTION: 'attr',
}));

let map;
let marker;
let handlers;
let markerHandlers;

const makeFakeL = () => {
  handlers = {};
  markerHandlers = {};
  map = {
    setView: jest.fn(() => map),
    on: jest.fn((evt, fn) => {
      handlers[evt] = fn;
      return map;
    }),
    panTo: jest.fn(),
    remove: jest.fn(),
  };
  marker = {
    addTo: jest.fn(() => marker),
    on: jest.fn((evt, fn) => {
      markerHandlers[evt] = fn;
      return marker;
    }),
    setLatLng: jest.fn(),
    getLatLng: jest.fn(() => ({ lat: 1.5, lng: 2.5 })),
    remove: jest.fn(),
  };
  return {
    map: jest.fn(() => map),
    tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
    marker: jest.fn(() => marker),
  };
};

const originalGeo = navigator.geolocation;
const setGeo = (value) =>
  Object.defineProperty(navigator, 'geolocation', { value, configurable: true });

afterEach(() => {
  setGeo(originalGeo);
  jest.useRealTimers();
});

describe('MapPicker', () => {
  it('shows an accessible map with the India fallback view and no pin', async () => {
    const L = makeFakeL();
    loadLeaflet.mockResolvedValue(L);
    render(<MapPicker value={null} onChange={jest.fn()} />);
    expect(screen.getByRole('application')).toHaveAttribute('aria-label');
    await waitFor(() => expect(map.setView).toHaveBeenCalledWith([20.59, 78.96], 5));
    expect(L.marker).not.toHaveBeenCalled();
  });

  it('reports a tap on the map through onChange', async () => {
    loadLeaflet.mockResolvedValue(makeFakeL());
    const onChange = jest.fn();
    render(<MapPicker value={null} onChange={onChange} />);
    await waitFor(() => expect(handlers.click).toBeDefined());
    act(() => handlers.click({ latlng: { lat: 19.1, lng: 72.9 } }));
    expect(onChange).toHaveBeenCalledWith({ lat: 19.1, lng: 72.9 });
  });

  it('creates a draggable marker for a value and emits on dragend', async () => {
    const L = makeFakeL();
    loadLeaflet.mockResolvedValue(L);
    const onChange = jest.fn();
    render(<MapPicker value={{ lat: 1, lng: 2 }} onChange={onChange} />);
    await waitFor(() => expect(L.marker).toHaveBeenCalled());
    expect(L.marker.mock.calls[0][1].draggable).toBe(true);
    act(() => markerHandlers.dragend());
    expect(onChange).toHaveBeenCalledWith({ lat: 1.5, lng: 2.5 });
    expect(screen.getByTestId('map-picker-coords')).toHaveTextContent('1.00000, 2.00000');
  });

  it('uses the current location when allowed', async () => {
    loadLeaflet.mockResolvedValue(makeFakeL());
    setGeo({ getCurrentPosition: (ok) => ok({ coords: { latitude: 28.6, longitude: 77.2 } }) });
    const onChange = jest.fn();
    render(<MapPicker value={null} onChange={onChange} />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    expect(onChange).toHaveBeenCalledWith({ lat: 28.6, lng: 77.2 });
    expect(map.setView).toHaveBeenLastCalledWith([28.6, 77.2], 16);
  });

  it('shows a clear message when geolocation is denied', async () => {
    loadLeaflet.mockResolvedValue(makeFakeL());
    setGeo({ getCurrentPosition: (ok, fail) => fail({ code: 1 }) });
    render(<MapPicker value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    expect(
      await screen.findByText('Location unavailable. Tap the map to choose where the problem is.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use my current location/i })).toBeEnabled();
  });

  it('does not spin forever if geolocation never answers', async () => {
    loadLeaflet.mockResolvedValue(makeFakeL());
    setGeo({ getCurrentPosition: jest.fn() });
    jest.useFakeTimers();
    render(<MapPicker value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    act(() => {
      jest.advanceTimersByTime(11000);
    });
    expect(screen.getByText(/location unavailable/i)).toBeInTheDocument();
  });

  it('shows Map could not load with Retry when the CDN fails', async () => {
    loadLeaflet.mockRejectedValueOnce(new Error('cdn'));
    render(<MapPicker value={null} onChange={jest.fn()} />);
    expect(await screen.findByText('Map could not load')).toBeInTheDocument();

    loadLeaflet.mockResolvedValue(makeFakeL());
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(map.setView).toHaveBeenCalled());
    expect(screen.queryByText('Map could not load')).not.toBeInTheDocument();
  });
});
