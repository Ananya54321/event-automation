require('dotenv').config();
const { scrapeCryptoNomadsEvents } = require('./index');
const { fetchLumaEvents } = require('./luma-scraper');
const supabase = require('./supabaseClient');
const { appendRow, readRows, updateRow, getSheetNames, addSheet } = require('./sheetsClient');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

// Cache for metadata
let countriesMap = new Map(); // name -> id
let categoriesMap = new Map(); // name -> id
let domainsMap = new Map(); // name -> id

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
}

function getCountryId(countryName) {
  if (!countryName) return null;
  // Try exact match
  let id = countriesMap.get(countryName.toLowerCase());
  if (id) return id;
  
  // Try partial match or common mappings if needed (simple version for now)
  // e.g., "USA" -> "United States"
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
  
  // Default to 'Conference' if nothing else found and it looks like one? 
  // For now, just return what we find.
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
  
  // Special case for "Ethereum" -> "ETHGlobal" or similar if needed
  // The user listed "ETHGlobal" as a domain.
  if (lowerText.includes('ethglobal')) {
      const ethId = domainsMap.get('ethglobal');
      if (ethId && !ids.includes(ethId)) ids.push(ethId);
  }
  
  return ids;
}

async function insertEventWithRelations(event) {
    // 1. Prepare Event Data
    const countryId = getCountryId(event.country);
    
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
        links: links,
        socials: socials,
        communities: [], // Default empty
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
  const events = await scrapeCryptoNomadsEvents();
  console.log(`Found ${events.length} events from Crypto-Nomads.`);

  for (const event of events) {
    // Check if exists in Supabase (check by name or link? User said event_url)
    // But links is an array now. We need to check if the array contains the url.
    // Supabase array contains check: .contains('links', [url])
    
    const { data: existing, error } = await supabase
      .from('events')
      .select('id')
      .contains('links', [event.event_url])
      .maybeSingle();

    if (error) {
      console.error('Error checking Supabase for event:', event.event_url, error);
      continue;
    }

    if (!existing) {
      console.log(`Inserting new event: ${event.name}`);
      await insertEventWithRelations(event);
    } else {
      console.log(`Event already exists: ${event.name}`);
    }
  }
}

async function syncLumaToSheet() {
  console.log('Starting Luma Sync to Sheet...');
  const events = await fetchLumaEvents();
  console.log(`Found ${events.length} events from Luma.`);

  if (!SPREADSHEET_ID) {
    console.error('SPREADSHEET_ID not set in .env');
    return;
  }

  try {
    const sheetNames = await getSheetNames(SPREADSHEET_ID);
    console.log('Available Sheets:', sheetNames);
    
    const existingSheet = sheetNames.find(s => s.toLowerCase() === SHEET_NAME.toLowerCase());
    
    if (existingSheet) {
        console.log(`Using existing sheet: ${existingSheet}`);
        // Use the actual casing from the sheet
        // But SHEET_NAME is const, so we can't reassign it easily unless we change logic.
        // However, A1 notation is usually case insensitive for sheet names?
        // Let's just proceed. If we need to use the exact name, we might need to pass it to readRows.
    } else {
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
    const { data: existingInDb } = await supabase
      .from('events')
      .select('id')
      .contains('links', [eventUrl])
      .maybeSingle();

    if (existingInDb) {
      console.log(`Luma event already in Supabase: ${event.name}`);
      continue;
    }

    if (existingUrls.has(eventUrl)) {
      console.log(`Luma event already in Sheet: ${event.name}`);
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
      'FALSE',
      'FALSE'
    ];

    await appendRow(SPREADSHEET_ID, SHEET_NAME, rowValues);
  }
}

async function syncSheetToSupabase() {
  console.log('Starting Sheet to Supabase Sync...');
  if (!SPREADSHEET_ID) return;

  const rows = await readRows(SPREADSHEET_ID, SHEET_NAME);
  // Skip header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Name, Start, End, Location, Country, URL, Approve, Synced
    const [name, start_at, end_at, location, country, url, approve, synced] = row;

    if (approve && approve.toUpperCase() === 'TRUE' && synced !== 'TRUE') {
      console.log(`Syncing approved event from sheet: ${name}`);
      
      const eventObj = {
        name,
        start_date: start_at,
        end_date: end_at,
        location,
        country,
        event_url: url,
        venue_type: 'in_person', // Default for now, maybe add column later
        socials: [] // Sheet doesn't have socials column yet
      };

      await insertEventWithRelations(eventObj);

      // Update row to mark as synced
      const newRow = [...row];
      newRow[7] = 'TRUE'; // Synced column index 7
      await updateRow(SPREADSHEET_ID, SHEET_NAME, i, newRow);
    }
  }
}

async function main() {
  await loadMetadata();
  await syncCryptoNomads();
  await syncLumaToSheet();
  await syncSheetToSupabase();
}

main().catch(console.error);
