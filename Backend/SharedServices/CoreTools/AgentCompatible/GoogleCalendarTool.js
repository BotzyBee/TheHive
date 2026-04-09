/**
 * 🐝 TheHive Plugin Tool Standard
 * Google Calendar Management Tool
 */

export const details = {
    toolName: "manageCalendar",
    version: "1.1.0",
    creator: "System",
    overview: "Comprehensive Google Calendar management. Supports full CRUD operations and time-range based searching for events.",
    guide: "When the user asks for 'today', 'this week', or a specific date range, use the 'list' action and provide 'timeMin' and 'timeMax' in ISO 8601 format. Always request 'singleEvents: true' in your internal API call to ensure recurring events are expanded into individual instances. When creating events, ensure you have both a summary and valid start/end ISO timestamps.",
    inputSchema: JSON.stringify({
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create", "read", "list", "update", "delete"],
                "description": "The CRUD action to perform. Use 'list' for searching ranges or 'read' for a specific event ID."
            },
            "calendarId": {
                "type": "string",
                "description": "The ID of the calendar to access. Use 'primary' for the main user calendar.",
                "default": "primary"
            },
            "eventId": {
                "type": "string",
                "description": "The unique identifier of the event. Required for 'read', 'update', and 'delete' actions."
            },
            "timeMin": {
                "type": "string",
                "description": "The lower bound (exclusive) for an event's end time to filter by. Must be an ISO 8601 string."
            },
            "timeMax": {
                "type": "string",
                "description": "The upper bound (exclusive) for an event's start time to filter by. Must be an ISO 8601 string."
            },
            "q": {
                "type": "string",
                "description": "Free-text search terms to find events."
            },
            "eventDetails": {
                "type": "object",
                "description": "Data payload for 'create' or 'update' actions.",
                "properties": {
                    "summary": { "type": "string" },
                    "description": { "type": "string" },
                    "location": { "type": "string" },
                    "start": { 
                        "type": "object", 
                        "properties": {
                            "dateTime": { "type": "string" },
                            "timeZone": { "type": "string" }
                        }
                    },
                    "end": { 
                        "type": "object", 
                        "properties": {
                            "dateTime": { "type": "string" },
                            "timeZone": { "type": "string" }
                        }
                    }
                }
            }
        },
        "required": ["action"],
        "additionalProperties": false
    })
};

/**
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 */
export async function run(Shared, params = {}) {
    const tokenResult = await Shared.Utils.getGoogleAccessToken();
    if (tokenResult.isErr()) {
        return Shared.Utils.Err(`Error (manageCalendar): Failed to obtain Google Access Token. ${tokenResult.value}`);
    }

    const OAUTH_TOKEN = tokenResult.value;

    try {
        let resultData;
        let primaryCalendarId = 'bec156bfe09e07404c528f0d6313bb936723894ca654c97230200511a94307fb@group.calendar.google.com'; // Botzy Shared Calendar.
        const requestedAction = params.action;
        const targetCalendarId = encodeURIComponent(params.calendarId || primaryCalendarId);
        const targetEventId = params.eventId ? encodeURIComponent(params.eventId) : null;
        const targetEventDetails = params.eventDetails || null;

        if (!requestedAction) {
            throw new Error("Missing required parameter: 'action'.");
        }

        const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${targetCalendarId}/events`;
        const headers = {
            "Authorization": `Bearer ${OAUTH_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        const makeRequest = async (config) => {
            try {
                const response = await Shared.Utils.axiosHelper({ ...config, headers });
                return response.data;
            } catch (error) {
                const apiErrorMsg = error.response?.data?.error?.message || error.message;
                throw new Error(`Google API Error: ${apiErrorMsg}`);
            }
        };

        switch (requestedAction) {
            case 'create':
                if (!targetEventDetails) throw new Error("Missing 'eventDetails' for create action.");
                resultData = await makeRequest({
                    method: 'POST',
                    url: baseUrl,
                    data: targetEventDetails
                });
                break;

            case 'list':
                // 1. Build Query Parameters for filtering
                const queryParams = new URLSearchParams({
                    singleEvents: 'true', // Expand recurring events into individual instances
                    orderBy: 'startTime'  // Order by date (required for most list views)
                });

                if (params.timeMin) queryParams.append('timeMin', params.timeMin);
                if (params.timeMax) queryParams.append('timeMax', params.timeMax);
                if (params.q) queryParams.append('q', params.q);

                resultData = await makeRequest({
                    method: 'GET',
                    url: `${baseUrl}?${queryParams.toString()}`
                });
                break;

            case 'read':
                if (!targetEventId) throw new Error("Missing 'eventId' for read action.");
                resultData = await makeRequest({
                    method: 'GET',
                    url: `${baseUrl}/${targetEventId}`
                });
                break;

            case 'update':
                if (!targetEventId || !targetEventDetails) {
                    throw new Error("Missing 'eventId' or 'eventDetails' for update action.");
                }
                resultData = await makeRequest({
                    method: 'PATCH',
                    url: `${baseUrl}/${targetEventId}`,
                    data: targetEventDetails
                });
                break;

            case 'delete':
                if (!targetEventId) throw new Error("Missing 'eventId' for delete action.");
                await makeRequest({
                    method: 'DELETE',
                    url: `${baseUrl}/${targetEventId}`
                });
                resultData = { status: 204, message: "Resource successfully deleted." };
                break;

            default:
                throw new Error(`Unsupported calendar action: '${requestedAction}'`);
        }

        const message = new Shared.Classes.DataMessage({
            role: Shared.Classes.Roles.Tool,
            data: resultData,
            toolName: details.toolName,
            instructions: 'Summarise the calendar action results for the user.'
        });

        return Shared.Utils.Ok([message]);

    } catch (error) {
        return Shared.Utils.Err(`Error (manageCalendar): ${error.message}`);
    }
}