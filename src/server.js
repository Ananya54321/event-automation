const express = require('express');
const { startCronJobs } = require('./cron');
const { syncCryptoNomads, syncLumaToSheet, syncSheetToSupabase, loadMetadata } = require('./services/syncService');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Scraper Service is Running');
});

app.get('/trigger/daily', async (req, res) => {
  console.log('Manual trigger: Daily Sync');
  res.send('Triggered Daily Sync (Check logs)');
  try {
    await loadMetadata();
    await syncCryptoNomads();
    await syncLumaToSheet();
  } catch (e) {
    console.error(e);
  }
});

app.get('/trigger/sheet', async (req, res) => {
  console.log('Manual trigger: Sheet Sync');
  res.send('Triggered Sheet Sync (Check logs)');
  try {
    await syncSheetToSupabase();
  } catch (e) {
    console.error(e);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCronJobs();
});
