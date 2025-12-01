function generateUrlVariations(url) {
  if (!url) return [];

  let base = url.trim();
  base = base.replace(/^https?:\/\//, '');
  base = base.replace(/^www\./, '');
  
  if (base.endsWith('/')) {
      base = base.slice(0, -1);
  }

  const variations = new Set();

  const protocols = ['https://', 'http://', ''];
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
