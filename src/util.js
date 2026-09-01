/**
 * Shared tiny helpers.
 */

/** Render any thrown value as a one-line message for JSON error payloads. */
export function errorMessage(error) {
  return String(error?.message ?? error)
}
