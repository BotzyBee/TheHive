import { Services } from "../index.js";

// Curated data object
/**
 * 
 * @param {TextMessage | ImageMessage | AudioMessage | DataMessage}  messageObject 
 * @param {number} summaryDataSizeThreshold - max size (chars) before being summerised. Default 500.
 * @param {object} aiOptions - Any settings/ options for AI the ai call(s). 
 * @returns {Result[object]} - { key: [messageId], [messageId] : { ...Message content } }
 */
export async function processMessageForContext( messageObject, summaryDataSizeThreshold = 500, aiOptions = {} ) {
    if (!(messageObject instanceof Services.Classes.BaseMessage)) {
            return Services.Utils.Err(
            'Error (processMessageForContext) : messageObject must be an instance of BaseMessage or a class that extends it.');
        }

  // Init
  const stringRes = JSON.stringify(messageObject);
  const dataSize = stringRes.length ?? 0;
  const returnData = {
        key: messageObject.id,
        [messageObject.id]: { ...messageObject }
    }
  // Only summarize if data size exceeds the threshold
  if (dataSize > summaryDataSizeThreshold) {
    let summary = await shortenLargeValues(messageObject, summaryDataSizeThreshold,  aiOptions = {}) 
    // Returns a shortened version if needed.. if not returns initial value.
    if(summary.isErr()){
        return Services.Utils.Err(`Error (processMessageForContext -> shortenLargeValues) : ${summary.value}`)
    }
    returnData[messageObject.id] = summary.value;
  }
  return Services.Utils.Ok(returnData);
}

async function shortenLargeValues(data, maxSize,  aiOptions = {}, visited = new WeakSet()) {
    // 1. Immediate Primitives
    if (data === null || ["undefined", "boolean", "symbol", "bigint", "function"].includes(typeof data)) {
        return Services.Utils.Ok(data);
    }
    // 2. Prevent Infinite Recursion
    if (typeof data === 'object') {
        if (visited.has(data)) return Services.Utils.Ok("[Circular Reference]");
        visited.add(data);
    }

    // 3. Handle Strings/Numbers
    if (typeof data === 'string' || typeof data === 'number') {
        const strVal = String(data);
        if (strVal.length > maxSize) {
            // Catch Base64 data
            let base64Check = isBase64(data);
            if(base64Check === true ){ 
                return Services.Utils.Ok(`[ Base64 data. Length: ${strVal.length} ]`);
            }
            // Else create summary
            const summary = await createSummary(data,  aiOptions = {});
            return summary.isErr() ? summary : Services.Utils.Ok(summary.value);
        }
        return Services.Utils.Ok(data);
    }

    // 4. Binary Data
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        return data.byteLength > maxSize 
            ? Services.Utils.Ok(`[Large Binary Data: ${data.byteLength} bytes]`) 
            : Services.Utils.Ok(data);
    }

    // 4.5 Handle Dates
    if (data instanceof Date) {
        // Return as ISO string for consistency, or return 'data' to keep it as a Date object
        return Services.Utils.Ok(data.toISOString()); 
    }

    // 5. Recursion (Objects/Arrays)
    if (Array.isArray(data)) {
        // Use Promise.all for speed.
        const results = await Promise.all(data.map(item => shortenLargeValues(item, maxSize, aiOptions = {}, visited)));
        for (const res of results) if (res.isErr()) return res;
        return Services.Utils.Ok(results.map(r => r.value));
    }

    if (typeof data === 'object') {
        const newObject = {};
        for (const [key, value] of Object.entries(data)) {
            const res = await shortenLargeValues(value, maxSize, aiOptions = {}, visited);
            if (res.isErr()) return res;
            newObject[key] = res.value;
        }
        return Services.Utils.Ok(newObject);
    }
    return Services.Utils.Ok(data);
}

async function createSummary(stringRes, aiOptions = {}){
    // summarise data
    let dataSummary = await new Services.AiCall.AiCall().generateText(
        PromptsAndSchemas.summarySysPrompt,
        PromptsAndSchemas.summaryUsrPrompt(stringRes),
        aiOptions
    );
    if(dataSummary.isErr()){ 
        this.errors.push(`Error (curateToolData) : ${dataSummary.value}`);
        return Services.Utils.Err(`Error (curateToolData) : ${dataSummary.value}`)
    }
    // handle if object or not
    let summary;
    try {
        // catch arrays and objects
        summary = JSON.parse(dataSummary.value)
    } catch {
        // parse fails - treat as string
        summary = dataSummary.value;
    }
    return Services.Utils.Ok(summary);
}

function isBase64(str) {
    if (typeof str !== 'string' || str.length === 0) return false;

    // This regex looks for:
    // 1. Valid characters from BOTH sets: A-Z, a-z, 0-9, +, /, -, _
    // 2. Optional padding (=) at the end
    // 3. Ensuring the length (minus padding) makes sense
    const base64Regex = /^[A-Za-z0-9+/_-]+={0,2}$/;

    if (!base64Regex.test(str)) return false;

    // Final sanity check: Most Base64 (standard) requires length % 4 === 0.
    // However, URL-safe often strips padding. 
    // If it has padding, the total length MUST be a multiple of 4.
    if (str.includes('=') && str.length % 4 !== 0) {
        return false;
    }
    return true;
}

const PromptsAndSchemas = {
    summarySysPrompt: `You are a specialized data processing engine. 
    Your objective is to perform lossy compression on user-provided data structures by summarizing long text values while strictly maintaining the original schema and metadata
    Structural Integrity: You must return a data object or array with the exact same keys and hierarchy as the input.
    Key Matching: Input keys and output keys must be identical. Do not rename, omit, or add keys.
    When summarizing long strings ensure you prioritize the inclusion of key facts, entities, names, locations, file paths etc.
    If the data is encoded and/ or not plaintext then return a description of the data eg '[ Encoded data ]' or '[ Javascript Code ] etc.'`,
    summaryUsrPrompt: (inputData) => {
        return `Here is the input data needing summarized. Remember to match the return data structure to the input structure. Aim for 1-2 information dense short paragraphs. ### ${inputData} `
    }
}