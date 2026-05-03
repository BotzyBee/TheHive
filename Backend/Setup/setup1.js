import dotenv from 'dotenv';
import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';

// Setup1.js - For filesystem setup

export async function setupFilesAndFolders() {
  dotenv.config({ path: '.env' });
  const rootDirUrl = process.env.knowledgebaseHostURL;
  try {
    console.log('Creating required folders 📂');
    const dirs = [
      '/AppFiles/Plugins/Guides',
      '/AppFiles/Plugins/Tools',
      '/AppFiles/surreal.db',
      'AppFiles/n8n_data',
      '/AppFiles/Logging',
      '/UserFiles/',
    ];
    dirs.forEach((dir) => {
      let fullPath = path.join(rootDirUrl, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });

    // MOVE GUIDES OVER TO FOLDER - TODO !

    console.log('Files and Folders created ✔️');
  } catch (error) {
    console.log(`Error - (setupFilesAndFolders) : ${error}`);
  }
}
