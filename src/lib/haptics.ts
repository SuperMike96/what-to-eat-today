/**
 * Light haptic feedback helper wrapping the Vibration API.
 *
 * No-ops gracefully on devices / browsers without support (most desktops,
 * iOS Safari, etc.) so callers can fire it unconditionally. Patterns follow a
 * short, pleasant cadence: a single tick for a threshold crossing, a
 * double-pulse for a "like".
 */
type VibratableNavigator = Navigator & { vibrate?: (pattern: number | number[]) => boolean };

export function haptic(pattern: number | number[] = 12): void {
  if (typeof navigator === "undefined") return;
  const vibrate = (navigator as VibratableNavigator).vibrate;
  if (typeof vibrate !== "function") return;
  try {
    vibrate(pattern);
  } catch {
    /* ignore — haptics are a nice-to-have, never a failure point */
  }
}
