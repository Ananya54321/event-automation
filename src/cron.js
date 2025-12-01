const cron = require('node-cron');
const { syncCryptoNomads, syncLumaToSheet, syncSheetToSupabase, loadMetadata } = require('./services/syncService');

function startCronJobs() {
  console.log('Initializing Cron Jobs...');

  loadMetadata().catch(console.error);

  cron.schedule('0 0 * * *', async () => {
    console.log('Running Daily Sync...');
    try {
      await loadMetadata(); 
      await syncCryptoNomads();
      await syncLumaToSheet();
      console.log('Daily Sync Completed.');
    } catch (error) {
      console.error('Error in Daily Sync:', error);
    }
  });

  cron.schedule('*/5 * * * *', async () => {
    console.log('Running Sheet Sync...');
    try {
      await syncSheetToSupabase();
      console.log('Sheet Sync Completed.');
    } catch (error) {
      console.error('Error in Sheet Sync:', error);
    }
  });

  console.log('Cron Jobs Scheduled:');
  console.log('- Daily Sync (00:00): CryptoNomads & Luma -> Sheet');
  console.log('- Frequent Sync (Every 5m): Sheet -> Supabase');
}

module.exports = { startCronJobs };
