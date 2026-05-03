/**
 * 🐝 TheHive Plugin Tool Standard
 * Google Calendar Management Tool
 */

export const details = {
  toolName: 'manageCalendar',
  version: '1.1.0',
  creator: 'System',
  overview:
    'Comprehensive Google Calendar management. Supports full CRUD operations and time-range based searching for events.',
  guide: `CALENDAR TOOL EXECUTION PROTOCOL
To ensure successful tool execution and prevent parameter errors, strictly adhere to the following logic gates based on the selected action:
NOTE - IF not specifed, all times are UK time by default. Please specify timezone in eventDetails if different.

1. ACTION SELECTION & REQUIRED PARAMETERS
'list': Use for searching ranges or checking schedules.
Required: timeMin, timeMax (Both must be ISO 8601 strings).
Optional: q (keyword search), calendarId (default: "primary").

'read': Use ONLY when you have a specific eventId.
Required: eventId.
Forbidden: eventDetails, timeMin, timeMax.

'create': Use to add new events.
Required: eventDetails (must include summary, start.dateTime, and end.dateTime).

'update': Use to modify an existing event.
Required: eventId AND eventDetails (only include the fields being changed).

'delete': Use to remove an event.
Required: eventId.

2. DATA FORMATTING RULES
Timestamp Integrity: All timeMin, timeMax, and eventDetails.start/end.dateTime values must be in ISO 8601 format (e.g., 2026-04-10T15:30:00Z).
ID Persistence: Never hallucinate an eventId. If the user asks to "delete my last meeting" and you do not have the ID, you must perform a list action first to retrieve the correct eventId.
Object Nesting: When using eventDetails, ensure start and end are objects containing the dateTime key. Do not pass strings directly to start or end.

3. OPERATIONAL CONSTRAINTS
Defaulting: Always use "calendarId": "primary" unless the user explicitly specifies a secondary calendar ID.
Exclusivity: Do not provide timeMin or timeMax when performing read, update, or delete actions.
Search: Use the q parameter for text-based queries (e.g., "Doctor" or "Meeting") only within the list action.

EXAMPLE CALL LOGIC
User wants to see today's plan: Action: list + timeMin (start of day) + timeMax (end of day).
User wants to change a meeting time: Action: update + eventId + eventDetails (new start and end).`,
  inputSchema: JSON.stringify({
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'read', 'list', 'update', 'delete'],
        description:
          "The CRUD action to perform. Use 'list' for searching ranges or 'read' for a specific event ID.",
      },
      calendarId: {
        type: 'string',
        description:
          "The ID of the calendar to access. Use 'primary' for the main user calendar.",
        default: 'primary',
      },
      eventId: {
        type: 'string',
        description:
          "The unique identifier of the event. Required for 'read', 'update', and 'delete' actions.",
      },
      timeMin: {
        type: 'string',
        description:
          "The lower bound (exclusive) for an event's end time to filter by. Must be an ISO 8601 string.",
      },
      timeMax: {
        type: 'string',
        description:
          "The upper bound (exclusive) for an event's start time to filter by. Must be an ISO 8601 string.",
      },
      q: {
        type: 'string',
        description: 'Free-text search terms to find events.',
      },
      eventDetails: {
        type: 'object',
        description: "Data payload for 'create' or 'update' actions.",
        properties: {
          summary: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          start: {
            type: 'object',
            properties: {
              dateTime: { type: 'string' },
              timeZone: { type: 'string' },
            },
          },
          end: {
            type: 'object',
            properties: {
              dateTime: { type: 'string' },
              timeZone: { type: 'string' },
            },
          },
        },
      },
    },
    required: ['action'],
    additionalProperties: false,
  }),
};

/**
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 */
export async function run(Shared, params = {}) {
  const tokenResult = await Shared.v2Core.getGoogleAccessToken();
  if (tokenResult.isErr()) {
    return Shared.v2Core.Helpers.Err(
      `Error (manageCalendar): Failed to obtain Google Access Token. ${tokenResult.value}`
    );
  }

  const OAUTH_TOKEN = tokenResult.value;

  try {
    let resultData;
    const requestedAction = params.action;
    const targetCalendarId = encodeURIComponent(params.calendarId || 'primary');
    const targetEventId = params.eventId
      ? encodeURIComponent(params.eventId)
      : null;
    const targetEventDetails = params.eventDetails || null;

    if (!requestedAction) {
      throw new Error("Missing required parameter: 'action'.");
    }

    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${targetCalendarId}/events`;
    const headers = {
      Authorization: `Bearer ${OAUTH_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const makeRequest = async (config) => {
      try {
        const response = await Shared.aiAgents.ToolHelpers.axiosHelper({
          ...config,
          headers,
        });
        return response.data;
      } catch (error) {
        const apiErrorMsg =
          error.response?.data?.error?.message || error.message;
        throw new Error(`Google API Error: ${apiErrorMsg}`);
      }
    };

    switch (requestedAction) {
      case 'create':
        if (!targetEventDetails)
          throw new Error("Missing 'eventDetails' for create action.");
        resultData = await makeRequest({
          method: 'POST',
          url: baseUrl,
          data: targetEventDetails,
        });
        break;

      case 'list':
        // 1. Build Query Parameters for filtering
        const queryParams = new URLSearchParams({
          singleEvents: 'true', // Expand recurring events into individual instances
          orderBy: 'startTime', // Order by date (required for most list views)
        });

        if (params.timeMin) queryParams.append('timeMin', params.timeMin);
        if (params.timeMax) queryParams.append('timeMax', params.timeMax);
        if (params.q) queryParams.append('q', params.q);

        resultData = await makeRequest({
          method: 'GET',
          url: `${baseUrl}?${queryParams.toString()}`,
        });
        break;

      case 'read':
        if (!targetEventId)
          throw new Error("Missing 'eventId' for read action.");
        resultData = await makeRequest({
          method: 'GET',
          url: `${baseUrl}/${targetEventId}`,
        });
        break;

      case 'update':
        if (!targetEventId || !targetEventDetails) {
          throw new Error(
            "Missing 'eventId' or 'eventDetails' for update action."
          );
        }
        resultData = await makeRequest({
          method: 'PATCH',
          url: `${baseUrl}/${targetEventId}`,
          data: targetEventDetails,
        });
        break;

      case 'delete':
        if (!targetEventId)
          throw new Error("Missing 'eventId' for delete action.");
        await makeRequest({
          method: 'DELETE',
          url: `${baseUrl}/${targetEventId}`,
        });
        resultData = { status: 204, message: 'Resource successfully deleted.' };
        break;

      default:
        throw new Error(`Unsupported calendar action: '${requestedAction}'`);
    }

    const message = new Shared.aiAgents.Classes.DataMessage({
      role: Shared.aiAgents.Constants.Roles.Tool,
      data: resultData,
      toolName: details.toolName,
      instructions: 'Summarise the calendar action results for the user.',
    });

    return Shared.v2Core.Helpers.Ok([message]);
  } catch (error) {
    return Shared.v2Core.Helpers.Err(
      `Error (manageCalendar): ${error.message}`
    );
  }
}
