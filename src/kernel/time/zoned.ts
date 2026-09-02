/**
 * Wall-clock <-> UTC conversion for IANA time zones, built on Intl.DateTimeFormat.
 *
 * `wall` strings use the format produced/consumed by an HTML `datetime-local`
 * input: 'YYYY-MM-DDTHH:mm' (no seconds, no offset).
 */

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const MINUTE_MS = 60_000;

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    throw new Error(`Unknown or unsupported time zone: "${timeZone}".`);
  }
}

function partsToMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return map;
}

/** Offset in minutes such that `local wall clock = utc instant + offset`. */
function getOffsetMinutes(instant: Date, formatter: Intl.DateTimeFormat): number {
  const map = partsToMap(formatter.formatToParts(instant));
  const asUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24, // guards against ICU implementations that emit '24' for midnight
    Number(map.minute),
    Number(map.second),
  );
  // Floor to whole seconds: the formatter only has second-level resolution,
  // so diffing against a sub-second instant would leak spurious fractional
  // offsets during the binary search below.
  const flooredInstantMs = Math.floor(instant.getTime() / 1000) * 1000;
  return (asUtcMs - flooredInstantMs) / MINUTE_MS;
}

function parseWallClock(wall: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const match = WALL_CLOCK_PATTERN.exec(wall);
  if (!match) {
    throw new Error(`Invalid wall-clock time: "${wall}". Expected format YYYY-MM-DDTHH:mm.`);
  }
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const roundTrip = new Date(asUtcMs);
  const isRealCalendarMoment =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day &&
    roundTrip.getUTCHours() === hour &&
    roundTrip.getUTCMinutes() === minute;
  if (!isRealCalendarMoment) {
    throw new Error(`Invalid wall-clock time: "${wall}" does not correspond to a real calendar date.`);
  }

  return { year, month, day, hour, minute };
}

/**
 * Interprets `wall` ('YYYY-MM-DDTHH:mm') as wall-clock time in `timeZone` and
 * returns the corresponding UTC instant.
 *
 * A wall-clock time that does not exist because of a spring-forward DST gap
 * resolves to the first valid instant after the gap. An ambiguous fall-back
 * time resolves to one of its two valid instants, chosen deterministically so
 * that `utcToWallClock` round-trips it back to the same wall-clock string.
 */
export function wallClockToUtc(wall: string, timeZone: string): Date {
  const { year, month, day, hour, minute } = parseWallClock(wall);
  const formatter = createFormatter(timeZone);
  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const offsetInitial = getOffsetMinutes(new Date(asUtcMs), formatter);
  const guess1 = asUtcMs - offsetInitial * MINUTE_MS;
  const offsetGuess1 = getOffsetMinutes(new Date(guess1), formatter);
  if (offsetGuess1 === offsetInitial) {
    return new Date(guess1);
  }

  const guess2 = asUtcMs - offsetGuess1 * MINUTE_MS;
  const offsetGuess2 = getOffsetMinutes(new Date(guess2), formatter);
  if (offsetGuess2 === offsetGuess1) {
    return new Date(guess2);
  }

  // Neither offset reproduces the requested wall time: it falls in a
  // spring-forward gap. Binary-search the transition instant between the two
  // guesses and resolve to the first valid instant after the gap.
  let lo = Math.min(guess1, guess2);
  let hi = Math.max(guess1, guess2);
  const loOffset = getOffsetMinutes(new Date(lo), formatter);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (getOffsetMinutes(new Date(mid), formatter) === loOffset) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}

/**
 * Formats a UTC instant as a wall-clock string ('YYYY-MM-DDTHH:mm') in
 * `timeZone`. Inverse of {@link wallClockToUtc} for non-ambiguous instants.
 */
export function utcToWallClock(date: Date, timeZone: string): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid Date provided to utcToWallClock.');
  }
  const formatter = createFormatter(timeZone);
  const map = partsToMap(formatter.formatToParts(date));
  const hour = String(Number(map.hour) % 24).padStart(2, '0');
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}
