/**
 * Normalizes a URL to its "bare" form for deduplication.
 * Removes protocol, www, and trailing slashes.
 * @param {string} url 
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  if (!url) return '';
  
  // Remove protocol (http:// or https://)
  let normalized = url.replace(/^https?:\/\//, '');
  
  // Remove www.
  normalized = normalized.replace(/^www\./, '');
  
  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  // Lowercase for consistent comparison
  return normalized.toLowerCase();
}

module.exports = { normalizeUrl };
