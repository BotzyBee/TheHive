import { saveFile } from "../FileSystem/CRUD.js";
import { appFilesDir } from "../constants.js";
import { Ok, Err } from "./helperFunctions.js";

// [][] -- Log Helper Fn -- [][]
let allLogs = []; // Holds all logs until written to file.
const MAX_LOGS = 500;
export function log(...input) {
  console.log(...input);
  allLogs.push(JSON.stringify({
    timestamp: new Date().toISOString(),
    message: input,
  }, null, 2));
  if (allLogs.length > MAX_LOGS) {
    allLogs.shift();
  }
}

export async function writeLogsToFile(filename = 'logs.txt') {
    // Convert logs to a single string (separated by newlines)
    const logsString = allLogs.join('\n \n [][] -------- Log Entry ---------- [][] \n'); 
    await saveFile(`/data/${appFilesDir}/Logging`, logsString, filename); // using docker mapping.
}

/**
 * Formats a given number of bytes into a human-readable string (e.g., KB, MB, GB).
 * @param {number} bytes - The size in bytes.
 * @param {number} decimals - The number of decimal places to include (default is 2).
 * @returns {string} The formatted file size.
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 
 * @param {Buffer, Uint8Array, or ArrayBuffer} input 
 * @returns {string} - Base64 string
 */
export function toBase64(input) {
  if (input instanceof ArrayBuffer) {
    input = Buffer.from(new Uint8Array(input));
  } else if (input instanceof Uint8Array) {
    input = Buffer.from(input);
  } else if (!Buffer.isBuffer(input)) {
   Err('Error (toBase64) : Unsupported input type. Use Buffer, Uint8Array, or ArrayBuffer.');
  }
  return Ok(input.toString('base64'));
}

export function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {string | object | array | boolean} value 
 * @returns {string} - Returns a stringified version of the input data.
 */
export function escapeStringValues(value) {
  if (typeof value === 'string') {
    const quoted = JSON.stringify(value);
    return quoted.slice(1, -1);
  } else if (Array.isArray(value)) {
    return value.map(item => escapeStringValues(item));
  } else if (value !== null && typeof value === 'object') {
    for (const key in value) {
      if (!value.hasOwnProperty(key)) continue;
      value[key] = escapeStringValues(value[key]);
    }
  }
  return value;
}