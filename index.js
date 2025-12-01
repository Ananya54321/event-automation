const axios = require('axios');
const cheerio = require('cheerio');

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

    return ethereumEvents.map(event => ({
      name: event.event,
      country: (event.country || []).join(', '),
      location: (event.city || []).join(', '),
      venue_type: 'in_person',  
      start_date: event.startDate,
      end_date: event.endDate,
      event_url: event.link,
      socials: {
        twitter: event.twitter,
        telegram: event.telegram
      }
    }));

  } catch (error) {
    console.error('Error scraping events:', error.message);
    return [];
  }
}

module.exports = { scrapeCryptoNomadsEvents };
