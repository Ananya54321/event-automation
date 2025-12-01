require('dotenv').config();
const { getSheetNames } = require('./sheetsClient');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function main() {
  console.log('Spreadsheet ID:', SPREADSHEET_ID);
  try {
    const names = await getSheetNames(SPREADSHEET_ID);
    console.log('Sheet Names:', names);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
