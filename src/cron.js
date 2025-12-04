const cron = require('node-cron');
const { syncCryptoNomads, syncLuma, processApprovals } = require('./services/syncService');

function startCronJobs() {
  console.log('Initializing Cron Jobs...');
  cron.schedule('0 0 * * *', async () => {
    console.log('Running Daily Sync...');
    try {
      await syncCryptoNomads();
      await syncLuma();
      console.log('Daily Sync Completed.');
    } catch (error) {
      console.error('Error in Daily Sync:', error);
    }
  });
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running Approval Sync...');
    try {
      await processApprovals();
      console.log('Approval Sync Completed.');
    } catch (error) {
      console.error('Error in Approval Sync:', error);
    }
  });

  console.log('Cron Jobs Scheduled:');
  console.log('- Daily Sync (00:00): CryptoNomads -> Main DB, Luma -> Approval DB');
  console.log('- Frequent Sync (Every 5m): Approval DB -> Main DB');
}

module.exports = { startCronJobs };
