require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');

// Expecting GOOGLE_APPLICATION_CREDENTIALS in .env to point to the JSON key file
// or the user can provide the path directly here if they prefer.
// For now, we'll assume standard Google Auth discovery.

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

async function appendRow(spreadsheetId, sheetName, values) {
  const sheets = await getSheetsClient();
  const range = `${sheetName}!A:Z`; // Append to the end
  const resource = {
    values: [values],
  };
  
  try {
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource,
    });
    return result.data;
  } catch (err) {
    console.error('Error appending to sheet:', err);
    throw err;
  }
}

async function readRows(spreadsheetId, sheetName) {
  const sheets = await getSheetsClient();
  const range = `${sheetName}!A:Z`;
  
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return result.data.values || [];
  } catch (err) {
    console.error('Error reading from sheet:', err);
    throw err;
  }
}

async function updateRow(spreadsheetId, sheetName, rowIndex, values) {
    const sheets = await getSheetsClient();
    // rowIndex is 0-based index of the row in the sheet (but A1 notation is 1-based)
    const rowNum = rowIndex + 1; 
    const range = `${sheetName}!A${rowNum}`;
    
    const resource = {
        values: [values]
    };

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource
        });
    } catch (err) {
        console.error(`Error updating row ${rowNum}:`, err);
        throw err;
    }
}

async function getSheetNames(spreadsheetId) {
  const sheets = await getSheetsClient();
  try {
    const result = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    return result.data.sheets.map(s => s.properties.title);
  } catch (err) {
    console.error('Error getting sheet names:', err);
    throw err;
  }
}

async function addSheet(spreadsheetId, title) {
  const sheets = await getSheetsClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title
            }
          }
        }]
      }
    });
    console.log(`Created sheet: ${title}`);
  } catch (err) {
    console.error(`Error creating sheet ${title}:`, err);
    throw err;
  }
}

module.exports = {
  appendRow,
  readRows,
  updateRow,
  getSheetNames,
  addSheet
};
