import {
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isYesterday,
} from "date-fns";

/**
 * Timestamps on match cards. Recent matches read better as "3h ago"; older
 * ones as a date. The year is dropped for the current season to save width
 * on narrow screens.
 */
export function matchDate(iso: string) {
  const date = new Date(iso);

  if (isToday(date)) return `${formatDistanceToNowStrict(date)} ago`;
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "d MMM");
  return format(date, "d MMM yyyy");
}

/** Full timestamp for detail views. */
export function fullDate(iso: string) {
  return format(new Date(iso), "EEE d MMM yyyy, HH:mm");
}

/** "+3", "0", "-2" — goal difference always carries its sign. */
export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Initials for the avatar fallback. */
export function initials(name: string) {
  const parts = name.trim().split(/[\s_]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Prefers a chosen display name, falls back to the handle. */
export function displayName(person: {
  username: string;
  display_name?: string | null;
}) {
  return person.display_name?.trim() || person.username;
}

/** Rounds to one decimal but drops a trailing ".0". */
export function decimal(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}
