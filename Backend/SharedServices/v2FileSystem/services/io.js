import { FileRegistry } from "../core/classes.js";
import { saveFile, readFileContent } from "./CRUD.js";
import { Services } from "../../index.js";
import { readOfficeFileToString } from "../core/utils.js";

export const IOStrategies = {
  TEXT: {
    encoding: "utf-8",
    read: async (filePath) => await readFileContent(filePath, false),
    write: async (folder, content, fileName) => await saveFile(folder, content, fileName, { encoding: "utf-8" })
  },
  BINARY: {
    encoding: "binary",
    read: async (filePath) => await readFileContent(filePath, true),
    write: async (folder, content, fileName) => await saveFile(folder, content, fileName, { encoding: "binary" })
  },
  BASE64_IMAGE: {
    encoding: "base64",
    read: async (filePath, mime) => await readImageFileToBase64({ filePath, mimeType: mime }),
    write: async (folder, content, fileName) => {
      let prepImage = Services.aiAgents.AgentHelpers.prepareImageForSaving(content);
      if(prepImage.isErr()) return prepImage;
      return await saveFile(folder, prepImage.value, fileName )
    }
  },
  OFFICE_DOC: {
    encoding: "utf-8",
    read: async (filePath) => await readOfficeFileToString({ filePath }),
    write: null // Cannot natively write office docs easily
  },
  AUDIO_PCM: {
    encoding: "base64",
    read: null, // Add read logic if needed
    write: async (folder, content, fileName) => {
      let buffer = Services.aiAgents.AgentHelpers.processBase64Audio_ToWavBuffer(content, "audio/L16;codec=pcm;rate=24000");
      return await saveFile(folder, buffer, fileName);
    }
  }
};


// Instantiate and populate the registry
export const fileRegistry = new FileRegistry();

// Group similar types! Notice how much cleaner this is.
fileRegistry.register({
  name: "Text Document",
  mimes: ["text/plain", "text/css", "text/csv", "text/html", "text/svelte", "text/javascript", 
    "application/javascript", "application/json", "text/markdown", "text/md", "application/xml", "application/x-yaml"],
  exts: ["txt", "css", "csv", "html", "svelte", "js", "json", "md", "xml", "yaml", "rs"],
  strategy: IOStrategies.TEXT,
  defaultExt: "txt"
});

fileRegistry.register({
  name: "Base64 Image",
  mimes: ["image/png", "image/jpeg", "image/bmp", "image/gif", "image/webp"],
  exts: ["png", "jpg", "jpeg", "bmp", "gif", "webp"],
  strategy: IOStrategies.BASE64_IMAGE,
  defaultExt: "png"
});

fileRegistry.register({
  name: "Microsoft Word",
  mimes: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  exts: ["doc", "docx"],
  strategy: IOStrategies.OFFICE_DOC,
  defaultExt: "docx"
});

fileRegistry.register({
  name: "PCM Audio",
  mimes: ["audio/wav", "audio/L16;codec=pcm;rate=24000"],
  exts: ["wav"],
  strategy: IOStrategies.AUDIO_PCM,
  defaultExt: "wav"
});

// Binary catch-all
fileRegistry.register({
  name: "Binary File",
  mimes: ["application/octet-stream"],
  exts: ["bin", "exe", "dll"],
  strategy: IOStrategies.BINARY,
  defaultExt: "bin"
});