import {
  isVehicleTypeAllowed,
  resolveScheduledVehicleTypeFilter,
  SCHEDULED_VEHICLE_TYPES,
  ScheduledVehicleTypeFilter,
} from './scheduled-vehicle-type.util';

describe('scheduled-vehicle-type.util (admin-pricing enabled filter)', () => {
  describe('resolveScheduledVehicleTypeFilter', () => {
    it('returns only the requested type when it is enabled', () => {
      const result = resolveScheduledVehicleTypeFilter(
        ['JEEP', 'CAR', 'MICRO'],
        'MICRO',
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.vehicleTypes).toEqual(['MICRO']);
      expect(result.requestedVehicleType).toBe('MICRO');
      expect(result.enabledVehicleTypes).toEqual(
        new Set(['JEEP', 'CAR', 'MICRO']),
      );
    });

    it('rejects a requested type that is disabled in the admin pricings', () => {
      const result = resolveScheduledVehicleTypeFilter(
        ['CAR'],
        'JEEP',
      );

      expect(result.ok).toBe(false);
      expect(result.message).toContain('JEEP');
      expect(result.message).toContain('disabled');
      expect(result.vehicleTypes).toEqual([]);
    });

    it('rejects a requested type with no admin pricing row at all', () => {
      const result = resolveScheduledVehicleTypeFilter([], 'CAR');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain('CAR');
    });

    it('keeps only enabled scheduled types when no type is requested', () => {
      const result = resolveScheduledVehicleTypeFilter([
        'CAR',
        'MOTORBIKE',
        'MICRO',
      ]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Only scheduled + enabled types — MOTORBIKE is not a scheduled type.
      expect(result.vehicleTypes).toEqual(['CAR', 'MICRO']);
      expect(result.requestedVehicleType).toBeNull();
    });

    it('returns every scheduled type when all of them are enabled', () => {
      const result = resolveScheduledVehicleTypeFilter([
        'JEEP',
        'CAR',
        'MICRO',
      ]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.vehicleTypes).toEqual([...SCHEDULED_VEHICLE_TYPES]);
    });

    it('rejects when no scheduled vehicle type is enabled', () => {
      const result = resolveScheduledVehicleTypeFilter(['MOTORBIKE']);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain('No scheduled vehicle types');
    });

    it('treats an empty pricing list as "nothing enabled"', () => {
      const result = resolveScheduledVehicleTypeFilter([]);

      expect(result.ok).toBe(false);
    });
  });

  describe('isVehicleTypeAllowed', () => {
    const allEnabled = resolveScheduledVehicleTypeFilter([
      'JEEP',
      'CAR',
      'MICRO',
    ]);
    const onlyCar = resolveScheduledVehicleTypeFilter(['CAR']);
    const requestedMicro = resolveScheduledVehicleTypeFilter(
      ['JEEP', 'CAR', 'MICRO'],
      'MICRO',
    );

    const unwrap = (result: ReturnType<typeof resolveScheduledVehicleTypeFilter>): ScheduledVehicleTypeFilter => {
      if (!result.ok) throw new Error('expected an ok filter');
      return result;
    };

    it('allows an enabled availability-day type when nothing was requested', () => {
      const filter = unwrap(allEnabled);
      expect(isVehicleTypeAllowed('JEEP', filter)).toBe(true);
      expect(isVehicleTypeAllowed('CAR', filter)).toBe(true);
      expect(isVehicleTypeAllowed('MICRO', filter)).toBe(true);
    });

    it('filters out availability days of a disabled vehicle type', () => {
      const filter = unwrap(onlyCar);
      expect(isVehicleTypeAllowed('CAR', filter)).toBe(true);
      expect(isVehicleTypeAllowed('JEEP', filter)).toBe(false);
      expect(isVehicleTypeAllowed('MICRO', filter)).toBe(false);
    });

    it('only allows the requested vehicle type when one was provided', () => {
      const filter = unwrap(requestedMicro);
      expect(isVehicleTypeAllowed('MICRO', filter)).toBe(true);
      expect(isVehicleTypeAllowed('CAR', filter)).toBe(false);
      expect(isVehicleTypeAllowed('JEEP', filter)).toBe(false);
    });

    it('rejects an unknown / missing vehicle type', () => {
      const filter = unwrap(allEnabled);
      expect(isVehicleTypeAllowed(null, filter)).toBe(false);
      expect(isVehicleTypeAllowed(undefined, filter)).toBe(false);
      expect(isVehicleTypeAllowed('', filter)).toBe(false);
    });

    it('rejects everything when the filter is missing', () => {
      expect(isVehicleTypeAllowed('CAR', undefined as any)).toBe(false);
    });
  });
});
