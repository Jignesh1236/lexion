export function sanitizePeerId(value) {
  if (!value) return null;
  const clean = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return clean || null;
}