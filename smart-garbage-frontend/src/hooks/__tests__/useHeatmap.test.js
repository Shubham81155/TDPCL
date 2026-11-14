import { radiusForCount, normalizeHeatmap, colorForIntensity, MIN_RADIUS, MAX_RADIUS } from '../useHeatmap';

describe('radiusForCount', () => {
  it('clamps to 6..30 and uses a sqrt scale', () => {
    expect(radiusForCount(0, 10)).toBe(MIN_RADIUS);
    expect(radiusForCount(10, 10)).toBe(MAX_RADIUS);
    expect(radiusForCount(99, 10)).toBe(MAX_RADIUS);
    expect(radiusForCount(5, 0)).toBe(MIN_RADIUS);
    expect(radiusForCount('x', 10)).toBe(MIN_RADIUS);
    expect(radiusForCount(25, 100)).toBeCloseTo(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) / 2);
    expect(radiusForCount(4, 100)).toBeLessThan(radiusForCount(16, 100));
  });
});

describe('normalizeHeatmap / colours', () => {
  it('converts string numbers and drops invalid rows', () => {
    const rows = normalizeHeatmap([
      { latitude: '12.5', longitude: '77.5', complaint_count: '4', has_urgent: 1 },
      { latitude: 'x', longitude: '1', complaint_count: '2' },
      { latitude: 1, longitude: 2, complaint_count: 0 },
    ]);
    expect(rows).toEqual([{ latitude: 12.5, longitude: 77.5, count: 4, urgent: true }]);
    expect(normalizeHeatmap(null)).toEqual([]);
  });

  it('colours by intensity', () => {
    expect(colorForIntensity(0.1)).toBe('#ffc107');
    expect(colorForIntensity(0.5)).toBe('#fd7e14');
    expect(colorForIntensity(1)).toBe('#dc3545');
  });
});
