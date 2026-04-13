import { readFileContent, saveFile } from "./CRUD.js";
import { readImageFileToBase64, readOfficeFileToString } from "../core/utils.js";
import { Services } from "../../index.js";

export const MIME_MAP = new Map([
  ["text/plain", 
    { extension: "txt", name: "Text Document", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["application/octet-stream", 
    { extension: "bin", name: "Binary File", encoding: "binary", 
      readFN: async (filePath) => await readFileContent(filePath, true), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["image/bmp", 
    { extension: "bmp", name: "Bitmap Image", encoding: "base64", 
      readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/bmp" }), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
    ],
  ["text/css", { extension: "css", name: "Cascading Style Sheet", encoding: "utf-8", 
    readFN: async (filePath) => await readFileContent(filePath, false), 
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
      await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
  ],
  ["text/csv", { extension: "csv", name: "Comma Separated Values", encoding: "utf-8", 
    readFN: async (filePath) => await readFileContent(filePath, false), 
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
      await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
  ],
  ["application/msword", { extension: "doc", name: "Microsoft Word Document (97-2003)", encoding: "utf-8", 
    readFN: async (filePath) => await readOfficeFileToString({filePath}), 
    writeFN: null }
  ],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
    { extension: "docx", name: "Microsoft Word Document", encoding: "utf-8", 
      readFN: async (filePath) => await readOfficeFileToString({filePath}), 
      writeFN: null }
    ],
  ["image/gif", 
    { extension: "gif", name: "GIF Image", encoding: "base64", 
      readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/gif" }), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
    ],
  ["text/html", 
    { extension: "html", name: "HTML Document", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["text/svelte", 
  { extension: "svelte", name: "Svelte Component", encoding: "utf-8", 
    readFN: async (filePath) => await readFileContent(filePath, false), 
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
      await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
  ],
  ["image/x-icon", 
    { extension: "ico", name: "Icon Image", encoding: "base64", 
      readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/x-icon" }), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
    ],
  ["image/jpeg", 
    { extension: "jpg", name: "JPEG Image", encoding: "base64", 
      readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/jpeg"}), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
    ],
  ["text/javascript", { extension: "js", name: "JavaScript File", encoding: "utf-8", 
    readFN: async (filePath) => await readFileContent(filePath, false), 
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
      await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
  ],
  ["application/javascript", { extension: "js", name: "JavaScript File", encoding: "utf-8", 
    readFN: async (filePath) => await readFileContent(filePath, false), 
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
      await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
  ],
  ["application/json", 
    { extension: "json", name: "JSON File", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["image/png", { extension: "png", name: "PNG Image", encoding: "base64", 
    readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/png"}), 
    writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
      await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
  ],
  ["application/pdf", 
    { extension: "pdf", name: "PDF Document", encoding: "utf-8", 
      readFN: async (filePath) => await readOfficeFileToString({filePath}), 
      writeFN: null }
    ],
  ["application/vnd.ms-powerpoint", 
    { extension: "ppt", name: "Microsoft PowerPoint Presentation (97-2003)", encoding: "utf-8", 
      readFN: async (filePath) => await readOfficeFileToString({filePath}), 
      writeFN: null }
    ],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", 
    { extension: "pptx", name: "Microsoft PowerPoint Presentation", encoding: "utf-8", 
      readFN: async (filePath) => await readOfficeFileToString({filePath}), 
      writeFN: null }
    ],
  ["image/svg+xml", 
    { extension: "svg", name: "Scalable Vector Graphics", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["image/tiff", 
    { extension: "tiff", name: "TIFF Image", encoding: "base64", 
      readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/tiff"}), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
    ],
  ["image/webp", 
    { extension: "webp", name: "WebP Image", encoding: "base64", 
      readFN: async (filePath) => await readImageFileToBase64({ filePath, mimeType: "image/webp"}), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt, {encoding: "base64"}) }
    ],
  ["application/vnd.ms-excel", 
    { extension: "xlw", name: "Microsoft Excel Worksheet (97-2003)", encoding: "utf-8", 
      readFN: async (filePath) => await readOfficeFileToString({filePath}), 
      writeFN: null }
    ],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
    { extension: "xlsx", name: "Microsoft Excel Spreadsheet", encoding: "utf-8", 
      readFN: async (filePath) => await readOfficeFileToString({filePath}), 
      writeFN: null }
    ],
  ["application/xml", 
    { extension: "xml", name: "XML Document", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["text/markdown", 
    { extension: "md", name: "Markdown File", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
      ["text/md", 
    { extension: "md", name: "Markdown File", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["application/x-yaml", 
    { extension: "yaml", name: "YAML File", encoding: "utf-8", 
      readFN: async (filePath) => await readFileContent(filePath, false), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["application/vnd.oasis.opendocument.text", 
    { extension: "odt", name: "OpenDocument Text", encoding: "binary", 
      readFN: async (filePath) => await readFileContent(filePath, true), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["application/vnd.oasis.opendocument.spreadsheet", 
    { extension: "ods", name: "OpenDocument Spreadsheet", encoding: "binary", 
      readFN: async (filePath) => await readFileContent(filePath, true), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["application/vnd.oasis.opendocument.presentation", 
    { extension: "odp", name: "OpenDocument Presentation", encoding: "binary", 
      readFN: async (filePath) => await readFileContent(filePath, true), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["application/vnd.oasis.opendocument.graphics", 
    { extension: "odg", name: "OpenDocument Graphic", encoding: "binary", 
      readFN: async (filePath) => await readFileContent(filePath, true), 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => 
        await saveFile(relativeFolderPath, fileContent, fileNameIncExt) }
    ],
  ["audio/mpeg", 
    { extension: "mp3", name: "MPEG-3 Audio", encoding: "base64", 
      readFN: null, 
      writeFN: null }
    ],
  ["audio/wav", 
    { extension: "wav", name: "Waveform Audio", encoding: "base64", 
      readFN: null, 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => {
        let process = Services.v2Core.Helpers.processBase64Audio_ToWavBuffer(fileContent, "audio/L16;codec=pcm;rate=24000");
        await saveFile(relativeFolderPath, process, fileNameIncExt)
      } }
    ],
  ["audio/L16;codec=pcm;rate=24000", 
    { extension: "wav", name: "PCM Audio", encoding: "base64", 
      readFN: null, 
      writeFN: async ({relativeFolderPath, fileContent, fileNameIncExt}) => {
        let process = Services.v2Core.Helpers.processBase64Audio_ToWavBuffer(fileContent, "audio/L16;codec=pcm;rate=24000");
        await saveFile(relativeFolderPath, process, fileNameIncExt)
      } }
    ],
  ["audio/mp4", 
    { extension: "m4a", name: "MPEG-4 Audio", encoding: "base64", 
      readFN: null, 
      writeFN: null }
    ]
]);