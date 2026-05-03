/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
  toolName: 'getContentsOfDirectory',
  version: '2026.0.2',
  creator: 'Botzy Bee',
  overview:
    'Scans the target directory returning a string all folders and file paths within it - including sub-directories. \n' +
    'This data is returned as two arrays of string (file & folder paths) values. \n' +
    "This tool does not return the data from any files. To do this you will need to use the 'readFile' tool. \n" +
    'You should use this tool if you are needing to read or modify a file however you first need to find the file path. \n' +
    'You can also use this tool to get an overview of the contents of a directory.',
  guide:
    "You need to provide a relative folder path. YOU MUST ensure that this doesn't start with /data/ - the root directory is /UserFiles/",
  inputSchema: {
    type: 'object',
    properties: {
      relativeFolderPath: {
        type: 'string',
        description: 'The relative path of the target folder.',
      },
    },
    required: ['relativeFolderPath'],
    additionalProperties: false,
  },
};

/**
 *
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services'
 * @param {object}  options
 * @param {string}  options.relativeFolderPath - Mandatory. The relative path of the target folder.
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run(Shared, params = {}) {
  // Destructure input
  const { relativeFolderPath } = params;

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

  // Catch bad params
  if (relativeFolderPath == null) {
    return Shared.v2Core.Helpers.Err(
      `Error (getContentsOfDirectory) : Params missing or incorrect. Params: relativeFolderPath`
    );
  }
  let call = await Shared.fileSystem.CRUD.scanFolderRecursively(
    decodedPath.trim()
  );
  if (call.isErr()) {
    return Shared.v2Core.Helpers.Err(
      `Error (getContentsOfDirectory -> scanFolderRecursively) : ${call.value}`
    );
  }

  let message = new Shared.aiAgents.Classes.DataMessage({
    role: Shared.aiAgents.Constants.Roles.Tool,
    mimeType: null,
    data: call.value,
    toolName: 'getContentsOfDirectory',
    instructions: `Get the contents of the directory ${relativeFolderPath}.`,
  });
  return Shared.v2Core.Helpers.Ok([message]);
}
