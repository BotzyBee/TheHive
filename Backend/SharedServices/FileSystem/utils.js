import { Ok, Err } from "../Utils/helperFunctions.js";
import { toBase64 } from "../Utils/misc.js";
import { readFileContent } from "./CRUD.js";
import officeParser from 'officeparser';

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
    let base64Data = toBase64(call.value)
    let returnFormat = `data:${params.mimeType};base64,${base64Data}`;
    return Ok(returnFormat);
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
        return Err(`Error (readImageFileToBase64) Paras needed filePath, mimeType. Provided: ${JSON.stringify(params)}`);
    }
    let call = await readFileContent(params.filePath, true);
    if (call.isErr()){ return Err(`Error (readImageFileToBase64 -> readFileContent) : ${call.value}`)}
    // parse from buffer
    try {
        let data = await officeParser.parseOfficeAsync(call.value);
        return Ok(data);
    } catch (error) {
        return Err(`Error (readOfficeFileToString) : ${error}`)
    }
}