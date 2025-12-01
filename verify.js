const { loadMetadata, syncCryptoNomads, syncLumaToSheet } = require('./src/services/syncService');

async function run() {
    try {
        await loadMetadata();
        console.log('--- Syncing Crypto Nomads ---');
        await syncCryptoNomads();
        console.log('--- Syncing Luma to Sheet ---');
        await syncLumaToSheet();
        console.log('--- Done ---');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
