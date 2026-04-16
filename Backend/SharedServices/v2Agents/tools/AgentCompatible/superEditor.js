/**
 * 🐝 TheHive Plugin Tool Standard - Super Editor
 * Version: 2.2.0 (Scalable Chunking)
 */

const SYSTEM_PROMPT = `
You are SuperEditor, a high-precision text editing agent.
You are currently editing a specific CHUNK of a larger document.

### Available Operations:
1. TARGETED REPLACEMENT (Preferred)
<<<< SEARCH
[Exact verbatim snippet from this chunk]
====
[The new text]
>>>>

2. REPLACE_ALL (Only if the chunk is small or needs a total rewrite)
<<<< REPLACE_ALL
====
[The entire new text for this chunk]
>>>>

### Rules:
1. Provide ONLY the blocks. No conversational filler.
2. SEARCH blocks must match the provided chunk EXACTLY.
3. Use UK English spelling (e.g., 'organise', 'colour').
4. If no edits are required for this specific chunk, return nothing.
`.trim();

let aiCount = 0;

export const details = {
    toolName: "superEditor",
    version: "2.2.2",
    creator: "TheHive",
    overview: "An advanced text editor capable of precise inline replacements, targeted insertions, and full document generation. Outputs structural diffs. Limitations: Cannot read external files or perform internet research. Operates strictly on the provided 'document' string.",
    guide: `Always provide the full 'document' state. If starting a new file, pass an empty string \"\". 
Output Format: You should craft consise and direct list of edits needed for the agent to follow. This should be short, clear and actionable. Do not include 'fluff' or general statements.
When crafting a list of edits quote sections of the text so that the edit agent knows where the change needs to happen (if the document isn't blank). 

Example Output: 
There are two section 5 titles. The second section 5 ('the title text') should be section 6. 
Remove duplicated paragraph starting with 'This text...' in section 3 which is the same as a paragraph in section 1.1. 
Change all instances of 'optimize' to 'optimise' for UK English consistency.
IMPORTANT: If no edits are needed output 'NO-EDITS-NEEDED'.`,
    inputSchema: JSON.stringify({
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "The specific instructions detailing the required edits or content generation."
            },
            "document": {
                "type": "string",
                "description": "The full, current document text. Pass an empty string for new documents."
            },
            "context": {
                "type": "string",
                "description": "Optional background information or reference material to guide the edits."
            }
        },
        "required": ["prompt", "document"],
        "additionalProperties": false
    })
};

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

/**
 * Core plugin execution interface.
 */

export async function run(Shared, params = {}, agent = {}) {
    const { prompt, document, context, chunkSize = 100000 } = params; // chunk size not included in schema as it's just for testing.
    const CHUNK_SIZE = chunkSize; // Character limit per AI call
    const { aiSettings = {}} = agent || {};

    if (!prompt || typeof document !== 'string') {
        
         return Shared.v2Core.Helpers.Err("SuperEditor: Missing prompt or document.");
    }
    safeEmit(agent, `Using SuperEditor to process the document - 🐝🔧`);
    // Failsafe for empty documents
    if (document.trim() === "") {
        return await handleNewDocument(Shared, prompt, context, aiSettings);
    }

    // Edit document with existing content
    try {
        const aiService = new Shared.callAI.aiFactory();
        const mutator = new DocumentMutator();
        
        // 1. Chunking
        const chunks = chunkText(document, CHUNK_SIZE);
        const processedChunks = [];

        for (let i = 0; i < chunks.length; i++) {
            safeEmit(agent, `SuperEditor - Editing chunk ${i + 1}/${chunks.length} 🐝`);
            const currentChunk = chunks[i];
            
            // 2. Build instructions for this specific slice
            const chunkPrompt = `
USER TASK: ${prompt}
CONTEXT: ${context || "None"}
CHUNK ${i + 1} OF ${chunks.length}:
---
${currentChunk}
---
            `.trim();
            const response = await aiService.generateText(SYSTEM_PROMPT, chunkPrompt, { ...aiSettings });
            aiCount++;
            if (response.isErr() || !containsActionableBlocks(response.value)) {
                processedChunks.push(currentChunk);
                continue;
            }

            // 3. Mutate the chunk
            const mutationResult = mutator.apply(currentChunk, response.value);
            processedChunks.push(mutationResult.success ? mutationResult.value : currentChunk);
        }

        // 4. Reassembly
        const finalDocument = processedChunks.join("");
        const textualDiff = computeTextDiff(document, finalDocument);

        if (agent && typeof agent.addAiCount === 'function') {
            agent.addAiCount(aiCount);
        }

         return Shared.v2Core.Helpers.Ok([
            new Shared.aiAgents.Classes.DataMessage({
                role: Shared.aiAgents.Constants.Roles.Tool,
                data: {
                    success: true,
                    editedDocument: finalDocument,
                    textualDiff: textualDiff,
                    chunksProcessed: chunks.length,
                    timestamp: new Date().toISOString()
                },
                toolName: details.toolName,
            })
        ]);

    } catch (error) {
         return Shared.v2Core.Helpers.Err(`Fatal error in SuperEditor: ${error.message}`);
    }
}

/**
 * Logic for handling completely new files
 */
async function handleNewDocument(Shared, prompt, context, aiSettings) {
    const aiService = new Shared.callAI.aiFactory();
    const response = await aiService.generateText(SYSTEM_PROMPT, `TASK: ${prompt}\nCONTEXT: ${context}\nDOCUMENT IS EMPTY. USE REPLACE_ALL.`, aiSettings);
    aiCount++;
    if (response.isErr()) return response;
    
    const mutator = new DocumentMutator();
    const result = mutator.apply("", response.value);
    
     return Shared.v2Core.Helpers.Ok([
        new Shared.aiAgents.Classes.DataMessage({
            role: Shared.aiAgents.Constants.Roles.Tool,
            data: { success: true, editedDocument: result.value },
            toolName: details.toolName,
        })
    ]);
}

/**
 * Splits text at newline boundaries to avoid breaking logic.
 */
function chunkText(text, size) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + size;
        if (end < text.length) {
            const lastNewline = text.lastIndexOf('\n', end);
            if (lastNewline > start) end = lastNewline + 1;
        }
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

function containsActionableBlocks(text) {
    return /(<<<< SEARCH|<<<< REPLACE_ALL)/.test(text);
}

class DocumentMutator {
    constructor() {
        this.blockPattern = /<<<< (SEARCH|REPLACE_ALL)\n([\s\S]*?)====\n([\s\S]*?)\n>>>>/g;
    }

    apply(sourceText, llmOutput) {
        let transientText = sourceText;
        const matches = [...llmOutput.matchAll(this.blockPattern)];

        for (const match of matches) {
            const [_, op, search, content] = match;
            if (op === 'REPLACE_ALL') {
                transientText = content;
            } else {
                const target = search.replace(/\n$/, '');
                if (transientText.includes(target)) {
                    transientText = transientText.replace(target, content);
                } else {
                    // Fuzzy fallback
                    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                    transientText = transientText.replace(new RegExp(escaped), content);
                }
            }
        }
        return { success: true, value: transientText };
    }
}

/**
 * Standard line-based diffing
 */
function computeTextDiff(oldStr, newStr) {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    let start = 0;
    while(start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while(oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--;
        newEnd--;
    }
    
    const diff = [];
    for(let i = start; i <= oldEnd; i++) diff.push(`- ${oldLines[i]}`);
    for(let i = start; i <= newEnd; i++) diff.push(`+ ${newLines[i]}`);
    return diff.join('\n');
}