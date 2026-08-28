import {
  DEFAULT_SEAT_CAPACITY,
  getEffectiveSeatCapacity,
  getRemainingSeats,
  canAccommodateParty,
} from './seat-calculator.util';

describe('seat-calculator.util (shared scheduled-ride capacity)', () => {
  describe('getEffectiveSeatCapacity', () => {
    it('uses the driver-configured seats when provided and > 0', () => {
      expect(getEffectiveSeatCapacity(4, 5)).toBe(4);
    });

    it('falls back to the vehicle type capacity when not configured', () => {
      expect(getEffectiveSeatCapacity(0, 5)).toBe(5);
      expect(getEffectiveSeatCapacity(undefined, 8)).toBe(8);
      expect(getEffectiveSeatCapacity(null, 15)).toBe(15);
    });

    it('falls back to the default capacity when nothing is resolvable', () => {
      expect(getEffectiveSeatCapacity(0, 0)).toBe(DEFAULT_SEAT_CAPACITY);
      expect(getEffectiveSeatCapacity(undefined, undefined)).toBe(DEFAULT_SEAT_CAPACITY);
    });
  });

  describe('getRemainingSeats', () => {
    it('subtracts booked passengers from the day capacity', () => {
      expect(getRemainingSeats(5, 2)).toBe(3);
    });

    it('never goes below zero even when over-booked', () => {
      expect(getRemainingSeats(4, 6)).toBe(0);
    });

    it('treats non-numeric input defensively', () => {
      expect(getRemainingSeats(5, undefined)).toBe(5);
      expect(getRemainingSeats(undefined, 5)).toBe(0);
    });
  });

  describe('canAccommodateParty', () => {
    // Capacity 5, 2 already booked -> 3 remaining.
    const capacity = 5;
    const booked = 2;

    it('allows a party that fits in the remaining seats', () => {
      expect(canAccommodateParty(capacity, booked, 3)).toBe(true);
      expect(canAccommodateParty(capacity, booked, 1)).toBe(true);
    });

    it('rejects a party larger than the remaining seats', () => {
      expect(canAccommodateParty(capacity, booked, 4)).toBe(false);
      expect(canAccommodateParty(capacity, 8, 1)).toBe(false);
    });

    it('rejects an empty/zero passenger party', () => {
      expect(canAccommodateParty(capacity, booked, 0)).toBe(false);
      expect(canAccommodateParty(capacity, booked, -1)).toBe(false);
    });

    it('allows up to the full capacity when nothing is booked yet', () => {
      expect(canAccommodateParty(5, 0, 5)).toBe(true);
      expect(canAccommodateParty(5, 0, 6)).toBe(false);
    });
  });
});
