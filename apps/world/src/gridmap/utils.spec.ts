import {
  buildGridConfigs,
  deriveTemperature,
  GRID_HEIGHT_CONFIG,
  GRID_MOISTURE_CONFIG,
} from './utils';

describe('gridmap utils', () => {
  it('returns the default grid configs', () => {
    const configs = buildGridConfigs();

    expect(configs.heightConfig).toBe(GRID_HEIGHT_CONFIG);
    expect(configs.moistureConfig).toBe(GRID_MOISTURE_CONFIG);
  });

  it('clamps derived temperature between 0 and 1', () => {
    const minTemp = deriveTemperature(1, -1, 2000);
    const maxTemp = deriveTemperature(-1, 1, 0);

    expect(minTemp).toBeGreaterThanOrEqual(0);
    expect(minTemp).toBeLessThanOrEqual(1);

    expect(maxTemp).toBeGreaterThanOrEqual(0);
    expect(maxTemp).toBeLessThanOrEqual(1);
  });

  it('reduces temperature with higher latitude and elevation', () => {
    const lowLatitude = deriveTemperature(0, 0, 0);
    const highLatitude = deriveTemperature(0, 0, 1500);
    const highElevation = deriveTemperature(1, 0, 0);

    expect(highLatitude).toBeLessThan(lowLatitude);
    expect(highElevation).toBeLessThan(lowLatitude);
  });
});
