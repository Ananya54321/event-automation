/**
 * Normalizes a URL by removing trailing slashes and ensuring consistent protocol.
 * @param {string} url 
 * @returns {string|null}
 */
function normalizeUrl(url) {
  if (!url) return null;
  try {
    // Add protocol if missing to allow URL parsing
    let urlToParse = url;
    if (!url.startsWith('http')) {
      urlToParse = 'https://' + url;
    }
    
    const parsed = new URL(urlToParse);
    
    // Remove www.
    let hostname = parsed.hostname.replace(/^www\./, '');
    
    // Remove trailing slash from pathname
    let pathname = parsed.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    // Reconstruct
    // We keep the protocol from the original if it had one, or default to https
    // But for deduplication, maybe we just want the domain + path?
    // User example: "https://ethprague.com", "ethprague.com", "https://www.ethprague.com"
    // Let's return a standard format: https://domain.com/path
    
    return `https://${hostname}${pathname}${parsed.search}`;
  } catch (e) {
    console.error('Error normalizing URL:', url, e);
    return url; // Return original if parsing fails
  }
}

/**
 * Returns null if the array is empty, otherwise returns the array.
 * @param {Array} arr 
 * @returns {Array|null}
 */
function nullIfEmpty(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }
  return arr;
}

module.exports = {
  normalizeUrl,
  nullIfEmpty
};
