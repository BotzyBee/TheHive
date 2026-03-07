
import dotenv from 'dotenv';
import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';

// Setup1.js - For filesystem setup

export async function setupFilesAndFolders(){
    dotenv.config({ path: ".env" });
    const rootDirUrl = process.env.knowledgebaseHostURL;
    try {
        console.log("Creating required folders 📂")
        const dirs = [
            '/AppFiles/Guides', 
            '/AppFiles/surreal.db', 
            '/AppFiles/Logging',
            '/AppFiles/Credentials',
            '/UserFiles/'
        ];
        dirs.forEach(dir => {
            let fullPath = path.join(rootDirUrl, dir);
            if(!fs.existsSync(fullPath)){
                fs.mkdirSync(fullPath, { recursive: true })}
            });
        
        // Create Guide Index File
        const guideIndexUrl = path.join(rootDirUrl, '/AppFiles/Guides');
        const filePath = path.join(guideIndexUrl, "index.json");
        const fileContent = `
{
"guides": {
    "guide1": {
        "relativeUrl": "/example1.txt",
        "description": "An example guide. Agents: Ignore this Guide, it is an example only!"
        }
    }
}`;
        await fsp.writeFile(filePath, fileContent, 'utf-8'); // write guide index file.
        console.log('Files and Folders created ✔️')
    } catch (error) {
        console.log(`Error - (setupFilesAndFolders) : ${error}`);
        
    }
}

