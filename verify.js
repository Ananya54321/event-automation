const { syncCryptoNomads, syncLuma, processApprovals } = require('./src/services/syncService');

async function run() {
    console.log('--- Starting Verification ---');
    try {
        console.log('--- Syncing Crypto Nomads ---');
        await syncCryptoNomads();
        
        console.log('--- Syncing Luma ---');
        await syncLuma();
        
        console.log('--- Processing Approvals ---');
        await processApprovals();
        
        console.log('--- Done ---');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
