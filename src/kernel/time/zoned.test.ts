import { describe, it, expect } from 'vitest';
import { wallClockToUtc, utcToWallClock } from './zoned';

const NY = 'America/New_York';

describe('wallClockToUtc', () => {
  it('converts a winter wall-clock time using the EST (UTC-5) offset', () => {
    const result = wallClockToUtc('2026-01-15T10:00', NY);
    expect(result.toISOString()).toBe('2026-01-15T15:00:00.000Z');
  });

  it('converts a summer wall-clock time using the EDT (UTC-4) offset', () => {
    const result = wallClockToUtc('2026-07-15T10:00', NY);
    expect(result.toISOString()).toBe('2026-07-15T14:00:00.000Z');
  });

  it('resolves a spring-forward gap wall time to the first valid instant after the gap', () => {
    // Clocks jump from 02:00 EST straight to 03:00 EDT on 2026-03-08.
    // 02:30 never exists; the first valid instant after the gap is 03:00 EDT = 07:00 UTC.
    const result = wallClockToUtc('2026-03-08T02:30', NY);
    expect(result.toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });

  it('resolves any nonexistent time within the gap to the same post-gap instant', () => {
    const result = wallClockToUtc('2026-03-08T02:00', NY);
    expect(result.toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });

  it('treats UTC as its own identity zone', () => {
    const result = wallClockToUtc('2026-06-01T12:00', 'UTC');
    expect(result.toISOString()).toBe('2026-06-01T12:00:00.000Z');
  });

  it('throws a clear error on malformed input', () => {
    expect(() => wallClockToUtc('not-a-date', NY)).toThrow();
    expect(() => wallClockToUtc('2026-13-01T10:00', NY)).toThrow();
    expect(() => wallClockToUtc('2026-02-30T10:00', NY)).toThrow();
    expect(() => wallClockToUtc('2026-01-15T25:00', NY)).toThrow();
    expect(() => wallClockToUtc('2026-01-15 10:00', NY)).toThrow();
  });

  it('throws a clear error on an unknown time zone', () => {
    expect(() => wallClockToUtc('2026-01-15T10:00', 'Not/AZone')).toThrow();
  });
});

describe('utcToWallClock', () => {
  it('is the inverse of wallClockToUtc for a normal winter time', () => {
    const wall = '2026-01-15T10:00';
    expect(utcToWallClock(wallClockToUtc(wall, NY), NY)).toBe(wall);
  });

  it('is the inverse of wallClockToUtc for a normal summer time', () => {
    const wall = '2026-07-15T10:00';
    expect(utcToWallClock(wallClockToUtc(wall, NY), NY)).toBe(wall);
  });

  it('round-trips stably through the fall-back overlap', () => {
    // 2026-11-01T01:30 America/New_York occurs twice (EDT then EST).
    // Whichever instant wallClockToUtc picks, converting back must reproduce the same wall time.
    const wall = '2026-11-01T01:30';
    const utc = wallClockToUtc(wall, NY);
    expect(utcToWallClock(utc, NY)).toBe(wall);
  });

  it('formats a UTC instant back to the identical wall clock for the UTC zone', () => {
    expect(utcToWallClock(new Date('2026-06-01T12:00:00.000Z'), 'UTC')).toBe('2026-06-01T12:00');
  });

  it('throws a clear error on an invalid Date', () => {
    expect(() => utcToWallClock(new Date('not-a-date'), NY)).toThrow();
  });

  it('throws a clear error on an unknown time zone', () => {
    expect(() => utcToWallClock(new Date(), 'Not/AZone')).toThrow();
  });
});
