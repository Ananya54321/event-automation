/**
 * Generates variations of a URL for deduplication purposes.
 * Variations include:
 * - http vs https
 * - www vs no-www
 * - trailing slash vs no trailing slash
 * 
 * @param {string} url 
 * @returns {string[]} Array of unique URL variations
 */
function generateUrlVariations(url) {
  if (!url) return [];

  // 1. Strip protocol and www to get the "base"
  let base = url.trim();
  base = base.replace(/^https?:\/\//, '');
  base = base.replace(/^www\./, '');
  
  // 2. Handle trailing slash on base
  // We want base without slash
  if (base.endsWith('/')) {
      base = base.slice(0, -1);
  }

  const variations = new Set();

  // 3. Reconstruct all combinations
  const protocols = ['https://', 'http://', '']; // including empty protocol (just domain/path)
  const prefixes = ['www.', ''];
  const suffixes = ['/', ''];

  protocols.forEach(proto => {
      prefixes.forEach(prefix => {
          suffixes.forEach(suffix => {
              variations.add(`${proto}${prefix}${base}${suffix}`);
          });
      });
  });

  return Array.from(variations);
}

module.exports = {
  generateUrlVariations
};
