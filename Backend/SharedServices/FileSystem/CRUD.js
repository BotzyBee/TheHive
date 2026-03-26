import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import * as su from '../Utils/index.js';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { containerVolumeRoot } from '../constants.js';

// [][] ---- CREATE ---- [][]
/**
 * Save Content to a file using Streams for memory efficiency.
 * @param {string} folderPath - The full filepath on the host machine (not docker/ container path)
 * @param {string | Buffer | Uint8Array | object | Readable} fileContent 
 * @param {string} fileNameIncExt 
 * @param {object} [options]
 * @param {BufferEncoding} [options.encoding] - optional, specify encoding.
 * @returns {Result} - {outcome: 'Ok' | 'Error', value: any }
 */
export async function saveFile(folderPath, fileContent, fileNameIncExt, options = {}) {
  const savePath = path.join(folderPath, fileNameIncExt);
  let sourceStream;
  // Default encoding for strings/objects
  let encoding = options.encoding || 'utf8';

  try {
    // Normalize the data into a Readable Stream
    if (fileContent instanceof Readable) {
      // It's already a stream (e.g., an incoming HTTP request or another file)
      sourceStream = fileContent;
    } else if (Buffer.isBuffer(fileContent) || fileContent instanceof Uint8Array) {
      // Raw binary data
      sourceStream = Readable.from(fileContent);
      encoding = undefined;
    } else if (typeof fileContent === 'string') {
      // Text or Base64 string
      sourceStream = Readable.from(fileContent);
    } else if (fileContent !== null && typeof fileContent === 'object') {
      // JSON Objects/Arrays
      const jsonString = JSON.stringify(fileContent, null, 2);
      sourceStream = Readable.from(jsonString);
    } else {
      return su.Err('Error - (saveFile) : Unsupported content type.');
    }

    // Ensure directory exists
    await fsp.mkdir(folderPath, { recursive: true });

    // Create the Write Stream and Pipe
    const writeStream = fs.createWriteStream(savePath, { encoding: encoding });

    // pipeline automatically handles errors and closes streams properly
    await pipeline(sourceStream, writeStream);

    return su.Ok(`File created in ${folderPath} called ${fileNameIncExt}`);
  } catch (error) {
    return su.Err(`Error - (saveFile) : ${error.message}`);
  }
}

// [][] ---- READ ---- [][]
/**
 * Read file content from file on host machine.
 * @param {string} filePath - full filepath of file location on host machine (not docker/ container url) 
 * @param {boolean} asBuffer - true = file will be read as buffer.
 * @param {object} options
 * @param {string} [options.encoding] - optional, specify the encoding if not binary. 
 * @returns {Result} - {outcome: 'Ok' | 'Error', value: any }
 */
export async function readFileContent(filePath, asBuffer = false, options) {
  if(!filePath) return su.Err(`Error (readFileContent) : No file path provided.`)
  const stats = await fsp.lstat(filePath);
  if (!stats.isFile()) {
    return su.Err(`Error: Path is not a file: ${filePath}`);
  }
  const encoding = options?.encoding || 'utf8';
  try {
    if (asBuffer) {
      // Read as a binary Buffer
      const bufferContent = await fsp.readFile(filePath);
      return su.Ok(bufferContent);
    } else {
      // Read as UTF-8 text or user specified encoding
      const textContent = await fsp.readFile(filePath, encoding);
      return su.Ok(textContent);
    }
  } catch (error) {
    return su.Err(`Error (readFileContent) : ${error}`);
  }
}

// NOTE - 
/**
 * Fetches the update, created, accessed times for a directory
 * @param {string} url - url must be a directory and be correctly escaped. 
 * @returns {Result} {outcome: 'Ok' | 'Error', value: any }
 *   Example Return Data
 */
export async function getUpdateStatsFromUrl(url) {
  url = decodeURIComponent(url); // handle encoded URLS
  try {
    const stats = await fsp.lstat(url);
    const data = {
      ...stats,
      atimeMs: Math.round(stats.atimeMs),//The last time the file was accessed.
      mtimeMs: Math.round(stats.mtimeMs),//The last time the file's data was modified.
      ctimeMs: Math.round(stats.ctimeMs),//The last time the file's status was changed (e.g., permissions, ownership).
      birthtimeMs: Math.round(stats.birthtimeMs),//The timestamp of when the file was created
    };
    return su.Ok(data);
  } catch (error) {
    return su.Err(error);
  }
}

/**
 * Returns a list of files and sub-directories
 * @param {string} url - must be a directory! 
 * @returns {Result} {outcome: 'Ok' | 'Error', value: any }
 */
export async function getFilesAndDirectoriesFromDir(url) {
  url = decodeURIComponent(url); // handle encoded URLS
  let fileList = [];
  let directorySet = new Set();
  try {
    // Read the contents of the directory
    const items = await fsp.readdir(url, { withFileTypes: true });
    // iterate over results
    for (const item of items) {
      const fullPath = path.join(url, item.name);
      if (item.isDirectory()) {
        // Get Update Stats
        const dirStats = await getUpdateStatsFromUrl(fullPath);
        // catch error
        if (dirStats.isErr()) {
          return su.Err(
            `Error - getFilesAndDirectoriesFromDir -> getUpdateStatsFromUrl(1) : ${dirStats.value}`
          );
        }
        // Add the current directory to the Set
        directorySet.add({ url: fullPath, updateMs: dirStats.value.mtimeMs });
      } else if (item.isFile()) {
        // Push files to fileList
        const fileType = getFileExtension(item.name);
        const fileUrl = path.resolve(fullPath);
        const fileStats = await getUpdateStatsFromUrl(fileUrl);
        if (fileStats.isErr()) {
          return su.Err(
            `Error - getFilesAndDirectoriesFromDir -> getUpdateStatsFromUrl(2) : ${fileStats.value}`
          );
        }
        fileList.push({
          fileName: item.name,
          fileUrl: fileUrl,
          fileType: fileType,
          updateMs: fileStats.value.mtimeMs,
        });
      }
    }
  } catch (error) {
    return su.Err(`Error (getFilesAndDirectoriesFromUrl) : ${error}`);
  }
  // Convert the Set back to an array before returning
  const directoryList = Array.from(directorySet);
  return su.Ok({ directoryList, fileList });
}

/**
 * Extracts the file extension by looking for the last full stop.
 * @param {string} filename - Name of the file including extension. 
 * @returns {string | null } - null if failed. 
 */
export function getFileExtension(filename) {
  // Find the last occurrence of the dot character in the filename.
  if (!filename) return null;
  const lastDotIndex = filename.lastIndexOf('.');
  // If no dot is found, or the dot is the first character (meaning no filename before it, like ".bashrc"),
  // or the dot is the last character (meaning no extension after it, like "folder."),
  // then there is no valid extension.
  if (
    lastDotIndex === -1 ||
    lastDotIndex === 0 ||
    lastDotIndex === filename.length - 1
  ) {
    return null;
  }
  // Extract the substring after the last dot.
  return filename.substring(lastDotIndex + 1);
}

/**
 * Gets the extension, size in bytes (raw and formatted)
 * @param {string} filePath - full filepath on the host system where the file can be located.
 * @returns {Result} { outcome: 'Ok' | 'Error', value: { extension, sizeBytes, sizeFormatted } | string }
 */
export function getFileExtensionAndSize(filePath) {
  try {
    // 1. Check if it exists at all before stating
    if (!fs.existsSync(filePath)) {
        return su.Err(`File does not exist at path: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    
    if (!stats.isFile()) {
        return su.Err(`Target is a directory, not a file: ${filePath}`);
    }

    const sizeBytes = stats.size;
    const ext = path.extname(filePath);
    const extension = ext ? ext.toLowerCase().substring(1) : ''; // Empty string for no extension
    
    return su.Ok({
      extension: extension,
      sizeBytes: sizeBytes,
      sizeFormatted: su.formatBytes(sizeBytes),
    });
  } catch (error) {
    return su.Err(`OS Error accessing file: ${error.message}`);
  }
}

/**
 * Scans the provided folder returning an array of sub-directories and files.  
 * @param {string} relativeFolderPath - relative folder path (container path) not host system path. 
 * @returns {Result} { outcome: 'Ok' | 'Error', value: { directoryList[string], fileList[string] } | string }
 */
export async function scanFolderRecursively(relativeFolderPath) {
  // Construct the full path
  const targetDirectoryInContainer = path.join(
    containerVolumeRoot,
    relativeFolderPath
  );
  let fileList = [];
  let directorySet = new Set();
  try {
    // Read the contents of the directory
    const items = await fsp.readdir(targetDirectoryInContainer, {
      withFileTypes: true,
    });
    for (const item of items) {
      const fullPath = path.join(relativeFolderPath, item.name);
      if (item.isDirectory()) {
        // If it's a directory, recursively call the function
        directorySet.add(fullPath); // Add the current directory to the Set
        let recCall = await scanFolderRecursively(fullPath);
        if (recCall.isErr()) {
          return su.Err(
            `Error (scanFolderRecursively) : Error scanning directory (recursive) ${fullPath} `
          );
        }
        const { directoryList: subfolderDirs, fileList: subfolderFiles } =
          recCall.value;
        fileList = fileList.concat(subfolderFiles);
        // Add all directories from subfolders to the Set
        subfolderDirs.forEach((dir) => directorySet.add(dir));
      } else if (item.isFile()) {
        const fileType = getFileExtension(item.name);
        // If it's a file, add URL to list
        let fileUrl = path.resolve(fullPath);
        fileList.push(removeAppPrefix(fileUrl)); // remove any /app/ prefix
      }
    }
  } catch (error) {
    return su.Err(
      `Error (scanFolderRecursively) : Error scanning directory ${relativeFolderPath} : ${error} `
    );
  }
  // Convert the Set back to an array before returning
  const directoryList = Array.from(directorySet);
  return su.Ok({ directoryList, fileList }); // Ok({ directoryList, fileList }) =  [String], [String]
}

function removeAppPrefix(str) {
  if (str.startsWith('/app/')) {
    return str.substring(5);
  }
  return str;
}
