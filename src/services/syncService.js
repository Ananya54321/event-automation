const { scrapeCryptoNomadsEvents } = require('./cryptoNomads');
const { fetchLumaEvents } = require('./luma');
const { getExistingLinks, createEvent, getApprovedEvents, updateSyncStatus } = require('./notion');
const { normalizeUrl } = require('../utils/urlUtils');

const MAIN_DB_ID = process.env.NOTION_MAIN_DB_ID;
const APPROVAL_DB_ID = process.env.NOTION_APPROVAL_DB_ID;

async function syncCryptoNomads() {
  console.log('Starting CryptoNomads Sync...');
  try {
    const events = await scrapeCryptoNomadsEvents();
    if (events.length === 0) {
      console.log('No events found from CryptoNomads.');
      return;
    }

    const existingMainLinks = await getExistingLinks(MAIN_DB_ID);
    const existingApprovalLinks = await getExistingLinks(APPROVAL_DB_ID);
    let newCount = 0;

    for (const event of events) {
      if (!event.event_url) continue;

      const normalizedUrl = normalizeUrl(event.event_url);

      if (!existingMainLinks.has(normalizedUrl) && !existingApprovalLinks.has(normalizedUrl)) {
        await createEvent(APPROVAL_DB_ID, {
          name: event.name,
          url: event.event_url,
          start_at: event.start_date,
          end_at: event.end_date,
          location: event.location,
          country: event.country,
          source: 'CryptoNomads',
          socials: event.socials,
          approved: false,
          venue_type: event.venue_type
        });
        newCount++;
      }
    }
    console.log(`CryptoNomads Sync Completed. Added ${newCount} new events to Approval DB.`);
  } catch (error) {
    console.error('Error in syncCryptoNomads:', error);
  }
}

async function syncLuma() {
  console.log('Starting Luma Sync...');
  try {
    const events = await fetchLumaEvents();
    if (events.length === 0) {
      console.log('No events found from Luma.');
      return;
    }

    // Check both Main DB and Approval DB to avoid duplicates
    const existingMainLinks = await getExistingLinks(MAIN_DB_ID);
    const existingApprovalLinks = await getExistingLinks(APPROVAL_DB_ID);
    
    let newCount = 0;

    for (const event of events) {
      if (!event.url) continue;

      const normalizedUrl = normalizeUrl(event.url);

      if (!existingMainLinks.has(normalizedUrl) && !existingApprovalLinks.has(normalizedUrl)) {
        await createEvent(APPROVAL_DB_ID, {
          name: event.name,
          url: event.url,
          start_at: event.start_at,
          end_at: event.end_at,
          location: event.location,
          country: event.country,
          source: 'Luma',
          socials: event.socials,
          approved: false,
          venue_type: event.location_type  
        });
        newCount++;
      }
    }
    console.log(`Luma Sync Completed. Added ${newCount} new events to Approval DB.`);
  } catch (error) {
    console.error('Error in syncLuma:', error);
  }
}

async function processApprovals() {
  console.log('Processing Approvals...');
  try {
    const approvedEvents = await getApprovedEvents(APPROVAL_DB_ID);
    
    if (approvedEvents.length === 0) {
      console.log('No approved events found.');
      return;
    }

    console.log(`Found ${approvedEvents.length} approved events. Syncing to Main DB...`);

    for (const event of approvedEvents) {
         
        console.log('Syncing Event:', JSON.stringify(event, null, 2));

        await createEvent(MAIN_DB_ID, event);

        await updateSyncStatus(event.pageId);
    }
    console.log('Approval Processing Completed.');
  } catch (error) {
    console.error('Error in processApprovals:', error);
  }
}

module.exports = {
  syncCryptoNomads,
  syncLuma,
  processApprovals
};
