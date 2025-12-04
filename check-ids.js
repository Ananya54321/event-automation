require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_INTEGRATION_SECRET });

const ENV_ID = process.env.NOTION_APPROVAL_DB_ID;
const USER_PROVIDED_ID = '2bf5f4ef34508074ac4afe63c6986c89';

async function checkDb(id, name) {
  console.log(`Checking ${name} (${id})...`);
  try {
    const response = await notion.databases.retrieve({ database_id: id });
    console.log(`SUCCESS: Connected to ${name}. Title: ${response.title[0]?.plain_text}`);
    return true;
  } catch (error) {
    console.error(`FAILURE: Could not access ${name}. Error: ${error.code} - ${error.message}`);
    return false;
  }
}

async function run() {
  await checkDb(ENV_ID, 'ENV_ID');
  await checkDb(USER_PROVIDED_ID, 'USER_PROVIDED_ID');
}

run();
