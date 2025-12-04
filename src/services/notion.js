const { Client } = require('@notionhq/client');
const { normalizeUrl } = require('../utils/urlUtils');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_INTEGRATION_SECRET });
 
async function getExistingLinks(databaseId) {
  let hasMore = true;
  let startCursor = undefined;
  const existingLinks = new Set();

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const linkProp = page.properties['Link'];
        if (linkProp && linkProp.files && linkProp.files.length > 0) {
            const file = linkProp.files[0];
            if (file.external && file.external.url) {
                existingLinks.add(normalizeUrl(file.external.url));
            }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
  } catch (error) {
    console.error(`Error fetching existing links from DB ${databaseId}:`, error.message);
  }

  return existingLinks;
}

async function createEvent(databaseId, eventData) {
  try {
    const properties = {
      'Event': {
        title: [
          {
            text: {
              content: eventData.name || 'Untitled Event',
            },
          },
        ],
      },
      'Link': {
        files: [
            {
                name: 'Event Link',
                external: {
                    url: eventData.url || 'https://example.com' 
                }
            }
        ]
      },
      'Start': {
        date: eventData.start_at ? { start: eventData.start_at } : null,
      },
      'End': {
        date: eventData.end_at ? { start: eventData.end_at } : null,
      },
      'Location (Optional)': {
        rich_text: [
          {
            text: {
              content: eventData.location || '',
            },
          },
        ],
      },
      'Venue Type': {
          select: {
              name: eventData.venue_type || 'IRL' 
          }
      }
    };

    if (eventData.hasOwnProperty('approved')) {
        properties['Approval Status'] = {
            checkbox: eventData.approved
        };
    }

    if (eventData.socials) {
        let twitterUrl = null;
        let telegramUrl = null;

        if (typeof eventData.socials === 'string') {
             twitterUrl = eventData.socials.startsWith('http') ? eventData.socials : `https://twitter.com/${eventData.socials}`;
        } else if (typeof eventData.socials === 'object') {
            if (eventData.socials.twitter) {
                twitterUrl = eventData.socials.twitter.startsWith('http') ? eventData.socials.twitter : `https://twitter.com/${eventData.socials.twitter}`;
            }
            if (eventData.socials.telegram) {
                telegramUrl = eventData.socials.telegram.startsWith('http') ? eventData.socials.telegram : `https://t.me/${eventData.socials.telegram}`;
            }
        }

        if (twitterUrl) {
            properties['Twitter'] = { url: twitterUrl };
        }
        if (telegramUrl) {
            properties['Telegram'] = { url: telegramUrl };
        }
    }
 
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: properties,
    });
    
    console.log(`Created event in Notion: ${eventData.name}`);
  } catch (error) {
    console.error(`Error creating event ${eventData.name} in Notion:`, error.message);
  }
}
 
async function getApprovedEvents(databaseId) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Approval Status',
        checkbox: {
          equals: true,
        },
      },
    });

    return response.results.map(page => {
        const props = page.properties;
        
        let url = '';
        if (props['Link']?.files?.length > 0) {
            url = props['Link'].files[0].external?.url || '';
        }

        const socials = {};
        if (props['Twitter']?.url) socials.twitter = props['Twitter'].url;
        if (props['Telegram']?.url) socials.telegram = props['Telegram'].url;

        return {
            pageId: page.id,
            name: props['Event']?.title[0]?.text?.content || '',
            url: url,
            start_at: props['Start']?.date?.start || null,
            end_at: props['End']?.date?.start || null,
            location: props['Location (Optional)']?.rich_text[0]?.text?.content || '',
            venue_type: props['Venue Type']?.select?.name || 'IRL',
            socials: socials
        };
    });
  } catch (error) {
    console.error(`Error fetching approved events from DB ${databaseId}:`, error.message);
    return [];
  }
}
 
async function deletePage(pageId) {
  try {
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });
    console.log(`Archived page ${pageId}`);
  } catch (error) {
    console.error(`Error archiving page ${pageId}:`, error.message);
  }
}

module.exports = {
  getExistingLinks,
  createEvent,
  getApprovedEvents,
  deletePage,
};
