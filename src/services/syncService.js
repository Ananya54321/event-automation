require('dotenv').config();
const supabase = require('../config/supabase');
const { appendRow, readRows, updateRow, getSheetNames, addSheet } = require('../config/sheets');
const { scrapeCryptoNomadsEvents } = require('./cryptoNomads');
const { fetchLumaEvents } = require('./luma');
const { normalizeUrl, nullIfEmpty } = require('../utils/helpers');
const { generateUrlVariations } = require('../utils/urlUtils');
const { getCountryFromPlace } = require('./geo');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

// Cache for metadata
let countriesMap = new Map(); // name -> id
let categoriesMap = new Map(); // name -> id
let domainsMap = new Map(); // name -> id
let existingEventsUrlMap = new Map(); // url -> id
let existingEventsDetailsMap = new Map(); // name|start|end -> id

async function loadMetadata() {
  console.log('Loading metadata...');
  
  // Load Countries
  const { data: countries, error: cError } = await supabase.from('countries').select('id, name');
  if (cError) console.error('Error loading countries:', cError);
  else countries.forEach(c => countriesMap.set(c.name.toLowerCase(), c.id));

  // Load Categories
  const { data: categories, error: catError } = await supabase.from('event_categories').select('id, name');
  if (catError) console.error('Error loading categories:', catError);
  else categories.forEach(c => categoriesMap.set(c.name.toLowerCase(), c.id));

  // Load Domains
  const { data: domains, error: dError } = await supabase.from('event_domains').select('id, name');
  if (dError) console.error('Error loading domains:', dError);
  else domains.forEach(d => domainsMap.set(d.name.toLowerCase(), d.id));
  
  console.log(`Loaded ${countriesMap.size} countries, ${categoriesMap.size} categories, ${domainsMap.size} domains.`);
  console.log(`Loaded ${countriesMap.size} countries, ${categoriesMap.size} categories, ${domainsMap.size} domains.`);
}

function normalizeDate(d) {
    if (!d) return null;
    
    // If it's a string and looks like YYYY-MM-DD, just return that part
    // This avoids timezone shifting issues when parsing "YYYY-MM-DDTHH:mm:ss" (Local) vs "YYYY-MM-DD" (UTC)
    if (typeof d === 'string') {
        const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }

    try {
        // Return YYYY-MM-DD
        return new Date(d).toISOString().split('T')[0];
    } catch (e) {
        return d;
    }
}

function generateEventKey(name, start, end) {
    const n = name ? name.toLowerCase().trim() : '';
    const s = normalizeDate(start) || '';
    const e = normalizeDate(end) || '';
    return `${n}|${s}|${e}`;
}

async function loadExistingEvents() {
  console.log('Loading existing events from Supabase...');
  const { data: events, error } = await supabase
      .from('events')
      .select('id, name, start_date_time, end_date_time, links');
  
  if (error) {
      console.error('Error loading existing events:', error);
      return;
  }

  existingEventsUrlMap.clear();
  existingEventsDetailsMap.clear();

  events.forEach(e => {
      // Map by 0th link
      if (e.links && Array.isArray(e.links) && e.links.length > 0) {
          const link = e.links[0];
          if (link) existingEventsUrlMap.set(link, e.id);
      }
      
      if (e.name && e.start_date_time && e.end_date_time) {
          const key = generateEventKey(e.name, e.start_date_time, e.end_date_time);
          existingEventsDetailsMap.set(key, e.id);
      }
  });
  console.log(`Loaded ${events.length} existing events.`);
}

function getCountryId(countryName) {
  if (!countryName) return null;
  // Try exact match
  let id = countriesMap.get(countryName.toLowerCase());
  if (id) return id;
  
  // Try partial match or common mappings
  if (countryName.toLowerCase() === 'usa' || countryName.toLowerCase() === 'us') {
      return countriesMap.get('united states');
  }
  return null;
}

function inferCategories(text) {
  const ids = [];
  const lowerText = text.toLowerCase();
  
  categoriesMap.forEach((id, name) => {
    if (lowerText.includes(name)) {
      ids.push(id);
    }
  });
  
  return ids;
}

function inferDomains(text) {
  const ids = [];
  const lowerText = text.toLowerCase();
  
  domainsMap.forEach((id, name) => {
    if (lowerText.includes(name)) {
      ids.push(id);
    }
  });
  
  if (lowerText.includes('ethglobal')) {
      const ethId = domainsMap.get('ethglobal');
      if (ethId && !ids.includes(ethId)) ids.push(ethId);
  }
  
  return ids;
  return ids;
}

async function findExistingEvent(event) {
    const url = event.event_url || event.url;
    const name = event.name;
    const start = event.start_date || event.start_at || event.start_date_time;
    const end = event.end_date || event.end_at || event.end_date_time;

    // 1. Check URL variations against the map keys
    if (url) {
        const variations = generateUrlVariations(url);
        for (const v of variations) {
            if (existingEventsUrlMap.has(v)) {
                return existingEventsUrlMap.get(v);
            }
        }
    }

    // 2. Check Details
    if (name && start && end) {
        const key = generateEventKey(name, start, end);
        if (existingEventsDetailsMap.has(key)) {
            // console.log(`[Dedup] Found match by details: ${key}`);
            return existingEventsDetailsMap.get(key);
        }
    }
    
    return null;
}

async function insertEventWithRelations(event) {
    // 1. Prepare Event Data
    let countryId = getCountryId(event.country);
    
    // Fallback to Geoapify if country is missing but location exists
    if (!countryId && event.location) {
        console.log(`Country missing for ${event.name}, trying Geoapify with location: ${event.location}`);
        const fetchedCountry = await getCountryFromPlace(event.location);
        if (fetchedCountry) {
            console.log(`Geoapify found country: ${fetchedCountry}`);
            countryId = getCountryId(fetchedCountry);
        }
    }

    // Map venue_type
    let venueType = 'in_person';
    if (event.venue_type) venueType = event.venue_type;
    else if (event.location_type) {
        if (event.location_type === 'online') venueType = 'virtual';
        else if (event.location_type === 'hybrid') venueType = 'hybrid';
    }

    // Prepare arrays
    const links = event.event_url ? [event.event_url] : [];
    const socials = [];
    if (event.socials) {
        if (typeof event.socials === 'object' && !Array.isArray(event.socials)) {
            if (event.socials.twitter) socials.push(event.socials.twitter);
            if (event.socials.telegram) socials.push(event.socials.telegram);
        } else if (typeof event.socials === 'string') {
            socials.push(event.socials);
        } else if (Array.isArray(event.socials)) {
            socials.push(...event.socials);
        }
    }

    const eventData = {
        name: event.name,
        country_id: countryId,
        location: event.location,
        venue_type: venueType,
        start_date_time: event.start_date || event.start_at,
        end_date_time: event.end_date || event.end_at,
        links: nullIfEmpty(links),
        socials: nullIfEmpty(socials),
        communities: null, // Default null
        created_at: new Date(),
        updated_at: new Date(),
        has_timezone: false // Default
    };

    // 2. Insert Event
    const { data: insertedEvent, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

    if (error) {
        console.error('Error inserting event:', error);
        return;
    }

    const eventId = insertedEvent.id;
    console.log(`Inserted event ${event.name} (ID: ${eventId})`);

    // Update Cache
    if (links.length > 0) {
        existingEventsUrlMap.set(links[0], eventId);
    }
    if (eventData.name && eventData.start_date_time && eventData.end_date_time) {
        const key = generateEventKey(eventData.name, eventData.start_date_time, eventData.end_date_time);
        existingEventsDetailsMap.set(key, eventId);
    }

    // 3. Infer and Insert Categories
    const categoryIds = inferCategories(event.name + ' ' + (event.description || ''));
    if (categoryIds.length > 0) {
        const catInserts = categoryIds.map(catId => ({
            event_id: eventId,
            category_id: catId
        }));
        const { error: catError } = await supabase.from('event_category_events').insert(catInserts);
        if (catError) console.error('Error inserting categories:', catError);
    }

    // 4. Infer and Insert Domains
    const domainIds = inferDomains(event.name + ' ' + (event.description || ''));
    if (domainIds.length > 0) {
        const domInserts = domainIds.map(domId => ({
            event_id: eventId,
            domain_id: domId
        }));
        const { error: domError } = await supabase.from('event_domain_events').insert(domInserts);
        if (domError) console.error('Error inserting domains:', domError);
    }
}

async function syncCryptoNomads() {
  console.log('Starting Crypto-Nomads Sync...');
  await loadExistingEvents();
  const events = await scrapeCryptoNomadsEvents();
  console.log(`Found ${events.length} events from Crypto-Nomads.`);

  for (const event of events) {
    const normalizedUrl = normalizeUrl(event.event_url);
    if (!normalizedUrl) continue;

    const existingId = await findExistingEvent(event);

    if (!existingId) {
      console.log(`Inserting new event: ${event.name}`);
      await insertEventWithRelations(event);
    } else {
      console.log(`Event already exists: ${event.name}`);
    }
  }
}

async function syncLumaToSheet() {
  console.log('Starting Luma Sync to Sheet...');
  await loadExistingEvents();
  const events = await fetchLumaEvents();
  console.log(`Found ${events.length} events from Luma.`);

  if (!SPREADSHEET_ID) {
    console.error('SPREADSHEET_ID not set in .env');
    return;
  }

  try {
    const sheetNames = await getSheetNames(SPREADSHEET_ID);
    const existingSheet = sheetNames.find(s => s.toLowerCase() === SHEET_NAME.toLowerCase());
    
    if (!existingSheet) {
        console.log(`Sheet "${SHEET_NAME}" not found. Creating it...`);
        await addSheet(SPREADSHEET_ID, SHEET_NAME);
    }
  } catch (e) {
      console.error('Error checking/creating sheet:', e);
      return;
  }

  const rows = await readRows(SPREADSHEET_ID, SHEET_NAME);
  // Headers: Name, Start Date, End Date, Location, Country, URL, Approve, Synced
  
  const header = rows[0];
  if (!header || header.length === 0) {
      await appendRow(SPREADSHEET_ID, SHEET_NAME, ['Name', 'Start Date', 'End Date', 'Location', 'Country', 'URL', 'Approve', 'Synced']);
  }

  // URL is now at index 5 (F column)
  const existingUrls = new Set(rows.map(row => row[5])); 

  for (const event of events) {
    const eventUrl = event.url;
    if (!eventUrl) continue;

    // Check Supabase
    // Check Supabase
    const existingInDbId = await findExistingEvent(event);

    if (existingInDbId) {
      console.log(`Luma event already in Supabase: ${event.name}`);
      continue;
    }

    if (existingUrls.has(eventUrl)) {
      // console.log(`Luma event already in Sheet: ${event.name}`);
      continue;
    }

    console.log(`Adding Luma event to Sheet: ${event.name}`);
    const rowValues = [
      event.name,
      event.start_at,
      event.end_at,
      event.location, // City/State
      event.country,  // Country
      eventUrl,
      'None', // Approve
      'FALSE' // Synced
    ];

    await appendRow(SPREADSHEET_ID, SHEET_NAME, rowValues);
  }
}

async function syncSheetToSupabase() {
  console.log('Starting Sheet to Supabase Sync...');
  if (!SPREADSHEET_ID) return;
  
  await loadExistingEvents();

  const rows = await readRows(SPREADSHEET_ID, SHEET_NAME);
  // Skip header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Name, Start, End, Location, Country, URL, Approve, Synced
    const [name, start_at, end_at, location, country, url, approve, synced] = row;

    // Check if approved is TRUE (case insensitive) and not yet synced
    if (approve && approve.toUpperCase() === 'TRUE' && synced !== 'TRUE') {
      console.log(`Syncing approved event from sheet: ${name}`);
      
      const eventObj = {
        name,
        start_date: start_at,
        end_date: end_at,
        location,
        country,
        event_url: url,
        venue_type: 'in_person', 
        socials: [] 
      };

      const existingId = await findExistingEvent(eventObj);
      if (existingId) {
          console.log(`Event already synced/exists in Supabase: ${name} (ID: ${existingId})`);
      } else {
          await insertEventWithRelations(eventObj);
      }

      // Update row to mark as synced
      // We need to preserve the other columns.
      // row is array of values.
      // We need to construct the full row to update.
      // Actually updateRow takes values array.
      const newRow = [...row];
      // Ensure we have enough elements
      while (newRow.length < 8) newRow.push('');
      newRow[7] = 'TRUE'; // Synced column index 7
      
      await updateRow(SPREADSHEET_ID, SHEET_NAME, i, newRow);
    }
  }
}

module.exports = {
  loadMetadata,
  syncCryptoNomads,
  syncLumaToSheet,
  syncSheetToSupabase
};
