# 🐝 TheHive – Plugin Tool Standard (v2026)

All **agent-compatible tools** must adhere to the following specification to ensure interoperability and reliability across the system. 

---

## 1. Required Tool Interface: The `details` Export

Each tool **must** export a `details` object. This object acts as the "manifest" that the AI uses to understand when and how to call your tool.

### Property Breakdown
* **`toolName` (String):** Must be a unique, camelCase identifier (e.g., `calculateInvoiceTotal`).
* **`version` (String):** Semantic versioning (e.g., `1.0.0`).
* **`creator` (String):** Your identifier or name.
* **`overview` (String):** A clear, concise description. **Crucial:** Define what the tool *does* and its *limitations* (what it cannot do) to prevent AI hallucinations.
* **`guide` (String | null):** Optional. Specific instructions or "Chain of Thought" hints for the AI to follow when using the results.
* **`inputSchema` (Stringified JSON):** * **Requirement:** This must be a **String**, not a raw JavaScript object. 
    * **Format:** Use `JSON.stringify({...})`. 
    * **Purpose:** This allows the system to validate inputs strictly against standard JSON Schema definitions before the tool even runs.

---

## 2. The `run` Function Logic

The core logic must be an exported `async` function.

### Arguments
* **`Shared`:** An object providing system-wide services:
    * `Shared.Classes.DataMessage`: Constructor for the tool's response.
    * `Shared.Classes.Roles`: Enum for message types (e.g., `Tool`).
    * `Shared.Utils.Ok()`: Success wrapper.
    * `Shared.Utils.Err()`: Failure wrapper.
* **`params`:** An object containing the arguments extracted from the AI's prompt based on your `inputSchema`.
* **`agent`:** An optional object for passing the agent object - to allow use of functions like emitUpdateStatus() or get agent data like agent.id (jobID).

### Return Value
The function must return a `Shared.Utils` wrapper:
* **Success:** `return Shared.Utils.Ok([DataMessage])` (The result must be an array of messages).
* **Failure:** `return Shared.Utils.Err("Descriptive error message")`.

---

## 3. Standard Boilerplate Template

Use the following template to start building a new tool.

```javascript
/**
 * 🐝 TheHive Plugin Tool Standard - Boilerplate
 */

export const details = {
    toolName: "myCustomTool",
    version: "1.0.0",
    creator: "YourName",
    overview: "Describe exactly what this tool does. Mention limitations here.",
    guide: null, 
    // IMPORTANT: inputSchema must be a stringified JSON object
    inputSchema: JSON.stringify({
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search term or query string"
            }
        },
        "required": ["query"],
        "additionalProperties": false
    })
};

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

/**
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 */
export async function run(Shared, params = {}, agent = {}) {
    const { query } = params;

    try {
        safeEmit(agent, `This is a status update message`); // send status updates back to user. 
        // 1. Tool Logic Here
        const resultData = {
            success: true,
            processed: query.toUpperCase(),
            timestamp: new Date().toISOString()
        };

        // 2. Construct the DataMessage
        const message = new Shared.Classes.DataMessage({
            role: Shared.Classes.Roles.Tool,
            data: resultData,
            toolName: details.toolName,
            instructions: "Summarize the processed data for the user."
        });

        // 3. Return as a successful result array
        return Shared.Utils.Ok([message]);

    } catch (error) {
        // Return structured error
        return Shared.Utils.Err(`Error in ${details.toolName}: ${error.message}`);
    }
}