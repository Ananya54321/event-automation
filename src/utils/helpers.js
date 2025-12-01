function normalizeUrl(url) {
  if (!url) return null;
  try {
    let urlToParse = url;
    if (!url.startsWith('http')) {
      urlToParse = 'https://' + url;
    }
    
    const parsed = new URL(urlToParse);
    
    let hostname = parsed.hostname.replace(/^www\./, '');
    
    let pathname = parsed.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    return `https://${hostname}${pathname}${parsed.search}`;
  } catch (e) {
    console.error('Error normalizing URL:', url, e);
    return url; 
  }
}

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
