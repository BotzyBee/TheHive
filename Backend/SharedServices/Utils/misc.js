

// [][] -- Log Helper Fn -- [][]
let allLogs = []; // Holds all logs until written to file.
const MAX_LOGS = 200;
export function log(...input) {
    console.log(...input);
    allLogs.push({
        timestamp: new Date().toISOString(),
        message: input
    });
    if (allLogs.length > MAX_LOGS) {
        allLogs.shift(); 
    }
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