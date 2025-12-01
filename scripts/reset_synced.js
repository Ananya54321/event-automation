require('dotenv').config();
const { readRows, updateRow } = require('./sheetsClient');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';

async function resetSynced() {
  const rows = await readRows(SPREADSHEET_ID, SHEET_NAME);
  const lastRowIndex = rows.length - 1;
  const lastRow = rows[lastRowIndex];
  
  console.log('Resetting Synced for:', lastRow[0]);
  
  const newRow = [...lastRow];
  newRow[7] = 'FALSE'; 
  
  await updateRow(SPREADSHEET_ID, SHEET_NAME, lastRowIndex, newRow);
  console.log('Reset complete.');
}

resetSynced().catch(console.error);
