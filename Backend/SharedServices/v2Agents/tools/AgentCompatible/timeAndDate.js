/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
  toolName: 'timeAndDateTool',
  version: '2026.0.1',
  creator: 'Botzy Bee',
  overview:
    'A tool for getting the current time and date. \n' +
    'Returns current epoch (ms), full Date Time, day of the month, day of the week, month, year and timezone. \n' +
    'This tool only returns the current date and cannot calculate relative dates - historical or in the future.',
  guide: null,
  inputSchema: {
    type: 'object',
    properties: {
      dateFormat: {
        type: 'string',
        description: "The formatting to use for example 'en-GB'",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

/**
 * Returns the current time and date.
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services'
 * @param {object}  options
 * @param {string}  options.dateFormat - The formatting to use for example 'en-GB'
 * @returns {Result[ [TextMessage ] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run(Shared, params = {}) {
  const dateFormat = params.dateFormat || 'en-GB';
  try {
    const now = new Date();
    // Current Epoch (ms)
    const currentEpoch = now.getTime();
    // Full Date Time (UK format)
    // Using toLocaleString with 'en-GB' for UK format
    const fullDateTime = now.toLocaleString(dateFormat, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false, // Ensure 24-hour format
    });
    // Day of Month (numerical representation)
    const dayOfMonth = now.getDate();
    // Day of Week (Monday, Tuesday etc)
    const dayOfWeek = now.toLocaleString(dateFormat, { weekday: 'long' });
    // Month (Name)
    const monthName = now.toLocaleString(dateFormat, { month: 'long' });
    // Month (Number)
    const monthNumber = now.getMonth() + 1;
    // Year
    const year = now.getFullYear();
    // Timezone
    // This will try to get the short timezone name (e.g., GMT, BST) if available,
    // otherwise it might return a standard offset string.
    const timezone = now
      .toLocaleDateString(dateFormat, {
        day: '2-digit',
        timeZoneName: 'short',
      })
      .substring(12); // Extracting just the timezone part

    let message = new Shared.aiAgents.Classes.DataMessage({
      role: Shared.aiAgents.Constants.Roles.Tool,
      data: {
        currentEpoch,
        fullDateTime,
        dayOfMonth,
        dayOfWeek,
        monthName,
        monthNumber,
        year,
        timezone,
      },
      toolName: 'timeAndDateTool',
      instructions: `Return the current time and date.`,
    });
    return Shared.v2Core.Helpers.Ok([message]);
  } catch (error) {
    return Shared.v2Core.Helpers.Err(`Error (timeAndDateTool) : ${error}`);
  }
}
