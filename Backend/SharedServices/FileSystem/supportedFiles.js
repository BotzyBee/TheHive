import { readFileContent, saveFile } from "./CRUD.js";
import { readImageFileToBase64, readOfficeFileToString } from "./utils.js";

export default {
  txt: {
    name: "Text Document",
    mimeType: "text/plain",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  bin: {
    name: "Binary File",
    mimeType: "application/octet-stream",
    encoding: "binary",
    readFN: async (filePath) => { return await readFileContent(filePath, true) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  bmp: {
    name: "Bitmap Image",
    mimeType: "image/bmp",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/bmp" }) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  css: {
    name: "Cascading Style Sheet",
    mimeType: "text/css",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  csv: {
    name: "Comma Separated Values",
    mimeType: "text/csv",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  doc: {
    name: "Microsoft Word Document (97-2003)",
    mimeType: "application/msword",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null 
  },
  docx: {
    name: "Microsoft Word Document",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  gif: {
    name: "GIF Image",
    mimeType: "image/gif",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/gif" }) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  htm: {
    name: "HTML Document",
    mimeType: "text/html",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  html: {
    name: "HTML Document",
    mimeType: "text/html",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  ico: {
    name: "Icon Image",
    mimeType: "image/x-icon",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/x-icon" }) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  jpeg: {
    name: "JPEG Image",
    mimeType: "image/jpeg",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/jpeg"}) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  jpg: {
    name: "JPEG Image",
    mimeType: "image/jpeg",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/jpeg"}) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  js: {
    name: "JavaScript File",
    mimeType: "text/javascript",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  json: {
    name: "JSON File",
    mimeType: "application/json",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  mjs: {
    name: "JavaScript Module File",
    mimeType: "text/javascript",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  png: {
    name: "PNG Image",
    mimeType: "image/png",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/png"}) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  pdf: {
    name: "PDF Document",
    mimeType: "application/pdf",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  ppt: {
    name: "Microsoft PowerPoint Presentation (97-2003)",
    mimeType: "application/vnd.ms-powerpoint",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  pptx: {
    name: "Microsoft PowerPoint Presentation",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  svg: {
    name: "Scalable Vector Graphics",
    mimeType: "image/svg+xml",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  tif: {
    name: "TIFF Image",
    mimeType: "image/tiff",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/tiff"}) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  tiff: {
    name: "TIFF Image",
    mimeType: "image/tiff",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/tiff"}) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  webp: {
    name: "WebP Image",
    mimeType: "image/webp",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/webp"}) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"})}
  },
  xls: {
    name: "Microsoft Excel Spreadsheet (97-2003)",
    mimeType: "application/vnd.ms-excel",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  xlsx: {
    name: "Microsoft Excel Spreadsheet",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  xml: {
    name: "XML Document",
    mimeType: "application/xml",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  markdown: {
    name: "Markdown File",
    mimeType: "text/markdown",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  md: {
    name: "Markdown File",
    mimeType: "text/markdown",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  xlw: {
    name: "Microsoft Excel Worksheet (97-2003)",
    mimeType: "application/vnd.ms-excel",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readOfficeFileToString({filePath}) },
    writeFN: null
  },
  yml: {
    name: "YAML File",
    mimeType: "application/x-yaml",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  yaml: {
    name: "YAML File",
    mimeType: "application/x-yaml",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  odt: {
    name: "OpenDocument Text",
    mimeType: "application/vnd.oasis.opendocument.text",
    encoding: "binary",
    readFN: async (filePath) => { return await readFileContent(filePath, true) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  ods: {
    name: "OpenDocument Spreadsheet",
    mimeType: "application/vnd.oasis.opendocument.spreadsheet",
    encoding: "binary",
    readFN: async (filePath) => { return await readFileContent(filePath, true) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  odp: {
    name: "OpenDocument Presentation",
    mimeType: "application/vnd.oasis.opendocument.presentation",
    encoding: "binary",
    readFN: async (filePath) => { return await readFileContent(filePath, true) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  odg: {
    name: "OpenDocument Graphic",
    mimeType: "application/vnd.oasis.opendocument.graphics",
    encoding: "binary",
    readFN: async (filePath) => { return await readFileContent(filePath, true) },
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => { 
      return await saveFile(relativeFolderPath, fileContent, fileNameIncExt)}
  },
  mp3: {
    name: "MPEG-3 Audio",
    mimeType: "audio/mpeg",
    encoding: "base64",
    readFN: null, 
    writeFN: null
  },
  wav: {
    name: "Waveform Audio",
    mimeType: "audio/wav",
    encoding: "base64",
    readFN: null, 
    writeFN: null
  },
  m4a: {
    name: "MPEG-4 Audio",
    mimeType: "audio/mp4",
    encoding: "base64",
    readFN: null, 
    writeFN: null
  },
};
