/**
 * Format a number with French-style non-breaking space thousands separator.
 * This avoids hydration mismatches caused by toLocaleString() which
 * produces different output on server (en-US: "2,340") vs client (fr-FR: "2 340").
 */
export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}
