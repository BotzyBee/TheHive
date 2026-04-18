import { setupFilesAndFolders } from './setup1.js';
import { setupFolderBotDB } from './setup2.js';
import { exec } from 'node:child_process'; // execSync
import util from 'util';

const execAsync = util.promisify(exec);

async function waitForSurreal(retries = 10, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        console.log("Calling DB...");
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
                console.log("❌ DB setup failed - ", err);
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

    // 2. Setup DB First
    try {
        console.log('🚀 Starting DB Build...');
        execAsync('docker-compose up -d indexdb', { stdio: 'inherit' });
    } catch (error) {
        console.log("❌ Failed to setup indexdb in docker")
        throw new Error("Failed to setup indexdb in docker"); 
    }


    // 3. Setup DB Folder/ Auth
    console.log("Giving the DB 8 secs to fully boot up...");
    await new Promise(res => setTimeout(res, 8000));
    await waitForSurreal();
    
    console.log("Starting Express Server.. ");
    try {
        console.log('🚀 Starting Server Build...');
        execAsync('docker-compose up -d aiserver', { stdio: 'inherit' });
    } catch (error) {
        console.log("❌ Failed to setup aiserver in docker")
        throw new Error("Failed to setup aiserver in docker"); 
    }
    console.log("Giving the Server 8 secs to fully boot up...");
    await new Promise(res => setTimeout(res, 8000));
    
    console.log('[][] ------------------ [][]');
    console.log('     The Hive is Alive! 🐝 🐝 🐝');
    console.log('[][] ------------------ [][]');
  } catch (error) {
    console.error('❌ init.js failed:', error.message);
    process.exit(1);
  }
}

runSetup();