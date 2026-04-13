import officeParser from 'officeparser';
import { readFileContent, saveFile } from '../services/CRUD.js';
import { Services } from '../../index.js';
import { appFilesDir } from './constants.js';

/**
 * Read Image file to Base64 string
 * @param {object} params 
 * @param {string} params.filePath - Required. File path where the file can be found.
 * @param {string} params.mimeType - Required. mimeType for the file needing processed.
 * @returns {Result} - { outcome: 'Ok' | 'Error', value: string (base64) | string (error) }
 */
export async function readImageFileToBase64(params = {}){
    // Check inputs are present
    let fp = params?.filePath ?? null;
    let mt = params?.mimeType ??  null;
    if(fp == null || mt == null){ 
        return Err(`Error (readImageFileToBase64) Paras needed filePath, mimeType. Provided: ${JSON.stringify(params)}`);
    }
    // read file to buffer
    let call = await readFileContent(params.filePath, true);
    if (call.isErr()){ return Err(`Error (readImageFileToBase64 -> readFileContent) : ${call.value}`)}
    // convert to base64
    let base64Data = Services.v2Core.Utils.toBase64(call.value)
    let returnFormat = `data:${params.mimeType};base64,${base64Data}`;
    return Services.v2Core.Helpers.Ok(returnFormat);
}

/**
 * Reads word, excel, powerpoint, openOffice & PDF files
 * @param {object} params 
 * @param {object} params.filePath - the URL path for the file 
 * @returns {Result} - { outcome: 'Ok' | 'Error', value: string }
 */
export async function readOfficeFileToString(params = {}){
    let fp = params?.filePath ?? null;
    if(fp == null){ 
        return Services.v2Core.Helpers.Err(`Error (readImageFileToBase64) Paras needed filePath, mimeType. Provided: ${JSON.stringify(params)}`);
    }
    let call = await readFileContent(params.filePath, true);
    if (call.isErr()){ return Services.v2Core.Helpers.Err(`Error (readOfficeFileToString -> readFileContent) : ${call.value}`)}
    // parse from buffer
    try {
        let data = await officeParser.parseOfficeAsync(call.value);
        return Services.v2Core.Helpers.Ok(data);
    } catch (error) {
        return Services.v2Core.Helpers.Err(`Error (readOfficeFileToString) : ${error}`)
    }
}

export async function writeLogsToFile(filename = 'logs.txt') {
    // Convert logs to a single string (separated by newlines)
    const logsString = Services.v2Core.Helpers.allLogs.join('\n \n [][] -------- Log Entry ---------- [][] \n'); 
    await saveFile(`/data/${appFilesDir}/Logging`, logsString, filename); // using docker mapping.
}
