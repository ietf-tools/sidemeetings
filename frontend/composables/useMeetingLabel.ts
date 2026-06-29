// Derives a meeting's display name from its number, adding the "IETF " prefix
// only when the number doesn't already carry it (e.g. "126" → "IETF 126",
// "IETF 126" → "IETF 126", "Interim-2026" → "Interim-2026").
export function meetingLabel(num: string | number | null | undefined): string {
  const s = String(num ?? '').trim()
  if (!s) return 'Untitled meeting'
  return /^ietf\b/i.test(s) ? s : `IETF ${s}`
}
