/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
  toolName: 'writeFile',
  version: '2026.0.5',
  creator: 'Botzy Bee',
  overview:
    'Writes (saves) data to a single file in a specified folder.' +
    'The content can be utf8, Uint8Array or Buffer. The tool does not perform any other task.',
  guide: null,
  inputSchema: {
    type: 'object',
    properties: {
      relativeFolderPath: {
        type: 'string',
        description:
          'The relative path to where the file should be saved within the knowledgebase.',
      },
      mimeType: {
        type: 'string',
        description:
          "Optional. The mime type of the data (e.g., 'text/markdown', 'image/png').",
      },
      fileContent: {
        description:
          'The file content. Can be a string, base64 data, or a Javascript object; the system handles serialization based on the mimeType/extension.',
      },
      fileName: {
        type: 'string',
        description:
          "The name of the file excluding the extension (e.g., 'report_summary').",
      },
      ext: {
        type: 'string',
        description:
          "An explicit file extension (e.g., 'js', '.md'). This is required to determine the tool to use to save the content.",
      },
    },
    required: ['relativeFolderPath', 'fileContent', 'fileName', 'ext'],
    additionalProperties: false,
  },
};

/**
 * * @param {Services} Shared - For passing the SharedServices object exported via 'Services'
 * @param {object}  options
 * @param {string}  options.relativeFolderPath - The relative path to where the file should be saved (within the knowledgebase)
 * @param {string}  options.mimeType - Optional. The mime type of the content needing saved.
 * @param {any}  options.fileContent - the file content, does not need to be stringified. This is handled automagically.
 * @param {string}  options.fileName - eg filename excluding extension
 * @param {string}  [options.ext] - explicit extension to use
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run(Shared, params = {}) {
  // Destructure input
  let { relativeFolderPath, fileContent, fileName, mimeType, ext } = params;

  fileName.replaceAll(' ', '_'); // sanitise filename to remove spaces (this breaks the readFile tool.)

  // Catch bad params
  if (
    relativeFolderPath == null ||
    fileContent == null ||
    fileName == null ||
    ext == null
  ) {
    return Shared.v2Core.Helpers.Err(
      `Error (writeFile) : Params missing or incorrect. Params: relativeFolderPath, fileContent, fileName, ext`
    );
  }

  const fileRegistry = Shared.fileSystem.IO.fileRegistry;

  // 1. Resolve Extension and Strategy
  // Logic: Use provided 'ext' first, otherwise lookup via 'mimeType'
  let fileConfig;
  let finalExtension;

  finalExtension = ext.replace(/^\.+/, ''); // Strip any dots
  fileConfig = fileRegistry.getByExt(finalExtension);

  const finalFileName = `${fileName}.${finalExtension}`;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(relativeFolderPath);
  } catch (e) {
    // If decoding fails, just use the original path
    decodedPath = relativeFolderPath;
  }

  // Catch if AI has added data prefix (remove it)
  const prefix = '/data/';
  if (decodedPath.startsWith(prefix)) {
    decodedPath = decodedPath.slice(prefix.length);
  }
  if (
    !decodedPath.startsWith('/UserFiles/') &&
    !decodedPath.startsWith('UserFiles/')
  ) {
    decodedPath = Shared.aiAgents.ToolHelpers.pathHelper.join(
      '/UserFiles/',
      decodedPath.trim()
    );
  }

  // 2. Resolve Paths
  const containerVolumeRoot = Shared.fileSystem.Constants.containerVolumeRoot;
  const targetDirectoryInContainer =
    Shared.aiAgents.ToolHelpers.pathHelper.join(
      containerVolumeRoot,
      decodedPath
    );

  // 3. Execute Write Strategy
  const strategy = fileConfig.strategy;

  if (strategy && typeof strategy.write === 'function') {
    let call = await strategy.write(
      targetDirectoryInContainer,
      fileContent,
      finalFileName
    );

    if (call?.outcome === 'Error') {
      return Shared.v2Core.Helpers.Err(
        `Error (writeFile -> strategy.write) : ${call.value}`
      );
    }

    // 4. Return Success Message
    let message = new Shared.aiAgents.Classes.TextMessage({
      role: Shared.aiAgents.Constants.Roles.Tool,
      mimeType: 'text/plain',
      ext: 'txt',
      textData: `File created in ${relativeFolderPath} with filename ${finalFileName} - using the ${fileConfig.name} strategy. Mark task as complete!`,
      toolName: 'writeFile',
      instructions: `Write content to file`,
    });

    return Shared.v2Core.Helpers.Ok([message]);
  } else {
    return Shared.v2Core.Helpers.Err(
      `Error (writeFile) : No write strategy available for type ${mimeType} (Extension: ${finalExtension}).`
    );
  }
}
