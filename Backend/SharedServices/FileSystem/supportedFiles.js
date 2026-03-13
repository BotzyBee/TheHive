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
    writeFN: null
  },
  css: {
    name: "Cascading Style Sheet",
    mimeType: "text/css",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  csv: {
    name: "Comma Separated Values",
    mimeType: "text/csv",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
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
    readFN: null
  },
  htm: {
    name: "HTML Document",
    mimeType: "text/html",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  html: {
    name: "HTML Document",
    mimeType: "text/html",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  ico: {
    name: "Icon Image",
    mimeType: "image/x-icon",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/x-icon" }) },
    writeFN: null
  },
  jpeg: {
    name: "JPEG Image",
    mimeType: "image/jpeg",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/jpeg"}) },
    writeFN: null
  },
  jpg: {
    name: "JPEG Image",
    mimeType: "image/jpeg",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/jpeg"}) },
    readFN: null
  },
  js: {
    name: "JavaScript File",
    mimeType: "text/javascript",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  json: {
    name: "JSON File",
    mimeType: "application/json",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  mjs: {
    name: "JavaScript Module File",
    mimeType: "text/javascript",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  png: {
    name: "PNG Image",
    mimeType: "image/png",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/png"}) },
    writeFN: null
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
    writeFN: null
  },
  tif: {
    name: "TIFF Image",
    mimeType: "image/tiff",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/tiff"}) },
    writeFN: null
  },
  tiff: {
    name: "TIFF Image",
    mimeType: "image/tiff",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/tiff"}) },
    writeFN: null
  },
  webp: {
    name: "WebP Image",
    mimeType: "image/webp",
    encoding: "base64",
    readFN: async (filePath) => { return await readImageFileToBase64({ filePath, mimeType: "image/webp"}) },
    writeFN: null
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
    writeFN: null
  },
  markdown: {
    name: "Markdown File",
    mimeType: "text/markdown",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
  },
  md: {
    name: "Markdown File",
    mimeType: "text/markdown",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
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
    writeFN: null
  },
  yaml: {
    name: "YAML File",
    mimeType: "application/x-yaml",
    encoding: "utf-8",
    readFN: async (filePath) => { return await readFileContent(filePath, false) },
    writeFN: null
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
  }
};
