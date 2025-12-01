require('dotenv').config();
const { readRows, updateRow } = require('./sheetsClient');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

async function approveLastEvent() {
  console.log('Reading rows...');
  const rows = await readRows(SPREADSHEET_ID, SHEET_NAME);
  
  if (rows.length <= 1) {
      console.log('No events to approve.');
      return;
  }

  const lastRowIndex = rows.length - 1;
  const lastRow = rows[lastRowIndex];
  
  console.log('Approving event:', lastRow[0]);  
  
  const newRow = [...lastRow];
  newRow[6] = 'TRUE';
  
  await updateRow(SPREADSHEET_ID, SHEET_NAME, lastRowIndex, newRow);
  console.log('Event approved.');
}

approveLastEvent().catch(console.error);
