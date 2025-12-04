const express = require('express');
const { startCronJobs } = require('./cron');
const { syncCryptoNomads, syncLuma, processApprovals } = require('./services/syncService');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Scraper Service is Running (Notion Integration)');
});

app.get('/trigger/daily', async (req, res) => {
  console.log('Manual trigger: Daily Sync');
  res.send('Triggered Daily Sync (Check logs)');
  try {
    await syncCryptoNomads();
    await syncLuma();
  } catch (e) {
    console.error(e);
  }
});

app.get('/trigger/approvals', async (req, res) => {
  console.log('Manual trigger: Approval Sync');
  res.send('Triggered Approval Sync (Check logs)');
  try {
    await processApprovals();
  } catch (e) {
    console.error(e);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCronJobs();
});
