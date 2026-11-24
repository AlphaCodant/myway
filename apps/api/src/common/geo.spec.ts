import { haversineMeters } from './geo';

describe('haversineMeters', () => {
  it('calcule environ 1,1 km pour 0,01° de latitude', () => {
    const d = haversineMeters({ lat: 6.13, lng: -5.95 }, { lat: 6.14, lng: -5.95 });
    expect(Math.round(d)).toBeGreaterThan(1100);
    expect(Math.round(d)).toBeLessThan(1115);
  });
});
