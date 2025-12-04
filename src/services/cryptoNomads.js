const axios = require('axios');
const cheerio = require('cheerio');
const { normalizeUrl } = require('../utils/urlUtils');

const URL = 'https://cryptonomads.org/?filter=ethereum';

async function scrapeCryptoNomadsEvents() {
  try {
    const { data } = await axios.get(URL);
    const $ = cheerio.load(data);

    const nextDataScript = $('#__NEXT_DATA__').html();
    if (!nextDataScript) {
      console.error('Could not find __NEXT_DATA__ script');
      return [];
    }

    const jsonData = JSON.parse(nextDataScript);
    const events = jsonData.props.pageProps.allEvents;

    if (!events || events.length === 0) {
      console.log('No events found in props.pageProps.allEvents');
      return [];
    }

    const ethereumEvents = events.filter(event => 
        event.tags && event.tags.some(tag => tag.toLowerCase() === 'ethereum')
    );

    if (ethereumEvents.length === 0) {
        console.log('No Ethereum events found.');
        return [];
    }

    return ethereumEvents.map(event => {
      let venueType = 'IRL';
      if (event.venue_type === 'virtual') venueType = 'Virtual';
      else if (event.venue_type === 'hybrid') venueType = 'Hybrid';
      else if (event.venue_type === 'offline') venueType = 'IRL';
      
      // Clean the URL using our utility, but we might want to keep the protocol for the actual link field
      // The requirement is to strip query elements. 
      // Let's just strip the query params from the event_url we store.
      let cleanUrl = event.link;
      if (cleanUrl) {
          cleanUrl = cleanUrl.split('?')[0];
      }

      return {
        name: event.event,
        country: (event.country || []).join(', '),
        location: (event.city || []).join(', '),
        venue_type: venueType,  
        start_date: event.startDate,
        end_date: event.endDate,
        event_url: cleanUrl,
        socials: {
          twitter: event.twitter,
          telegram: event.telegram
        }
      };
    });

  } catch (error) {
    console.error('Error scraping events:', error.message);
    return [];
  }
}

module.exports = { scrapeCryptoNomadsEvents };
