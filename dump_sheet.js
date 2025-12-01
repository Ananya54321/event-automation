require('dotenv').config();
const { readRows } = require('./sheetsClient');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

async function dumpSheet() {
  const rows = await readRows(SPREADSHEET_ID, SHEET_NAME);
  console.log('Sheet Content:');
  rows.forEach((row, i) => {
      console.log(`Row ${i}:`, row);
  });
}

dumpSheet().catch(console.error);
