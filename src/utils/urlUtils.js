function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized.toLowerCase();
}

module.exports = { normalizeUrl };
