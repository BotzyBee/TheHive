import { setupFilesAndFolders } from './setup1.js';
import { setupFolderBotDB } from './setup2.js';
import { execSync } from 'node:child_process';

async function waitForSurreal(retries = 10, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            await setupFolderBotDB();
            console.log('✔️ Surreal DB setup completed')
            return true;
        } catch (err) {
            let e = `${err}`;
            if(e.includes('already exists')){
                console.log('✔️ Surreal DB already exists!');
                return true;
            } else {
                console.log(err);
            }
            console.log(`⏳ SurrealDB not ready (Attempt ${i + 1}/${retries})...`);
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error('Could not connect to SurrealDB. Check if the Docker container is running.');
}

async function runSetup() {
  try {
    // 1. Folders
    await setupFilesAndFolders();

    // 2. Docker
    console.log('🚀 Starting containers...');
    execSync('docker-compose up --build -d', { stdio: 'inherit' });

    // 3. Setup Database
    await waitForSurreal();
    
    console.log('[][] ------------------ [][]');
    console.log('     The Hive is Alive! 🐝 🐝 🐝');
    console.log('[][] ------------------ [][]');
  } catch (error) {
    console.error('❌ init.js failed:', error.message);
    process.exit(1);
  }
}

runSetup();