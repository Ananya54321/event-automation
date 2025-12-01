require('dotenv').config();

/**
 * Fetches country information for a given place name using Geoapify.
 * @param {string} place 
 * @returns {Promise<string|null>} Country name or null
 */
async function getCountryFromPlace(place) {
  if (!place) return null;
  
  const apiKey = process.env.GEOAPIFY_APIKEY;
  if (!apiKey) {
    console.error('GEOAPIFY_APIKEY is not set');
    return null;
  }

  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(place)}&limit=1&apiKey=${apiKey}`;
    const res = await fetch(url);
    
    if (!res.ok) {
        console.error(`Geoapify error: ${res.status} ${res.statusText}`);
        return null;
    }
    
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    
    return props?.country || null;
  } catch (error) {
    console.error('Error fetching country from Geoapify:', error);
    return null;
  }
}

module.exports = {
  getCountryFromPlace
};
