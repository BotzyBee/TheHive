import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { SharedUtils } from '../Utils/index.js';
import { containerVolumeRoot } from '../../constants.js';

let su = new SharedUtils();

// [][] ---- CREATE ---- [][]
export async function saveFile(folderPath, fileContent, fileNameIncExt) {
  // note folderPath should be the filePath on the host machine eg C:/folder/here not the container path.
  let savePath = path.join(folderPath, fileNameIncExt);
  let dataToWrite;
  let encoding = 'utf8';
  // 1. Normalize the data
  if (Buffer.isBuffer(fileContent) || fileContent instanceof Uint8Array) {
    dataToWrite = fileContent;
    encoding = null; // No encoding for binary
  } else if (typeof fileContent === 'string') {
    dataToWrite = fileContent;
  } else if (
    Array.isArray(fileContent) ||
    (typeof fileContent === 'object' && fileContent !== null)
  ) {
    dataToWrite = JSON.stringify(fileContent, null, 2);
  } else {
    return su.logAndErr('Error - (saveFile) : Unsupported content type.');
  }
  // 2. Perform the action
  try {
    await fsp.mkdir(folderPath, { recursive: true });
    await fsp.writeFile(savePath, dataToWrite, encoding);
    return su.result_ok('File created');
  } catch (error) {
    return su.logAndErr(`Error - (saveFile) : ${error}`);
  }
}

// [][] ---- READ ---- [][]
export async function readFileContent(filePath, asBuffer = false) {
  try {
    if (asBuffer) {
      // Read as a binary Buffer
      const bufferContent = await fsp.readFile(filePath);
      return su.result_ok(bufferContent);
    } else {
      // Read as UTF-8 text by default
      const textContent = await fsp.readFile(filePath, 'utf8');
      return su.result_ok(textContent);
    }
  } catch (error) {
    return su.logAndErr(`Error (readFileContent) : ${error}`);
  }
}

// NOTE - url must be a directory and be correctly escaped
export async function getUpdateStatsFromUrl(url) {
  url = decodeURIComponent(url); // handle encoded URLS
  // GetUpdateStats() Example Return.value :
  // {
  //     dev: 0,
  //     mode: 16822,
  //     nlink: 1,
  //     uid: 0,
  //     gid: 0,
  //     rdev: 0,
  //     blksize: 4096,
  //     ino: 41376821576640376,
  //     size: 0,
  //     blocks: 8,
  //     atimeMs: 1748623136768.1797,
  //     mtimeMs: 1748465156062.4373, // Modified/ Updated Millis
  //     ctimeMs: 1748465156062.4373,
  //     birthtimeMs: 1748206665599.7468
  //   }
  try {
    let data = await fs.statSync(url);
    // round Millis -
    data.atimeMs = Math.round(data.atimeMs);
    data.mtimeMs = Math.round(data.mtimeMs);
    data.ctimeMs = Math.round(data.ctimeMs);
    data.birthtimeMs = Math.round(data.birthtimeMs);
    return su.result_ok(data);
  } catch (error) {
    return su.logAndErr(error);
  }
}

// NOTE - url must be a directory
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
          return su.logAndErr(
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
          return su.logAndErr(
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
    return su.logAndErr(`Error (getFilesAndDirectoriesFromUrl) : ${error}`);
  }
  // Convert the Set back to an array before returning
  const directoryList = Array.from(directorySet);
  return su.result_ok({ directoryList, fileList });
}

// THIS ONLY extracts the file extension from the name
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

export function getFileExtensionAndSize(filePath) {
  try {
    // Get file statistics, which includes the file size
    const stats = fs.statSync(filePath);
    // Get the file size in bytes
    const sizeBytes = stats.size;
    // path.extname returns '.ext', so we remove the leading dot
    const extension = path.extname(filePath).toLowerCase().substring(1);
    // Format the file size for better readability
    const sizeFormatted = su.formatBytes(sizeBytes);
    // Return result
    return su.result_ok({
      extension: extension,
      sizeBytes: sizeBytes,
      sizeFormatted: sizeFormatted,
    });
  } catch (error) {
    return su.logAndErr(`Error (getFileExtensionAndSize) : ${error}`);
  }
}

// Returns Ok({ directoryList, fileList }) =  [String], [String]
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
          return su.logAndErr(
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
    return su.logAndErr(
      `Error (scanFolderRecursively) : Error scanning directory ${relativeFolderPath} : ${error} `
    );
  }
  // Convert the Set back to an array before returning
  const directoryList = Array.from(directorySet);
  return su.result_ok({ directoryList, fileList }); // Ok({ directoryList, fileList }) =  [String], [String]
}

function removeAppPrefix(str) {
  if (str.startsWith('/app/')) {
    return str.substring(5);
  }
  return str;
}
