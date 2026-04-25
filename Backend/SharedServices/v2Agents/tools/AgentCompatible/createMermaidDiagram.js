/**
 * 🐝 TheHive Plugin Tool Standard - Mermaid Diagram Generator
 */


const MERMAID_GUIDE = `
Use Quoted Labels for All Nodes
Wrap node contents in double quotes to avoid issues with special characters or line breaks. Example: A["Initialize process"]. Quoted strings safely contain spaces, symbols, and line breaks (\n), preventing parse errors.

Use \n for Line Breaks
Use \n to break lines within a node label, like B["Step 1: Input\nStep 2: Validate"]. Avoid HTML tags like <br> — not supported and will throw parse errors.

Avoid or Escape Special Characters
Some characters can break the parser if used carelessly. Safe characters include (, ), :, ., -, _. Risky characters (like ', ", <, >, {}, &) should be wrapped inside quoted labels, e.g., C["Check job status ('allocated')"].

Use Unique Node IDs
Node identifiers must be unique and alphanumeric. Do not include spaces or special characters in the IDs. Use camelCase or snake_case formats, like validateInput, process_data.

Use Clear Flowchart Direction
Stick to standard flow directions: TD (Top Down) or LR (Left to Right). For example: flowchart TD followed by node connections like A --> B.

Keep Labels Short and Structured
Avoid long paragraphs in a single node. Break information into multiple nodes or use bulleted lines via \n. For example: D["Validate:\n• jobID exists\n• data format\n• user access"].

Avoid Unsupported Mermaid Features
Only basic flowchart syntax is supported. Avoid other diagram types like gantt, sequenceDiagram, classDiagram, as well as styling blocks or hyperlink nodes.

Avoid Advanced Styling or CSS
Do not use :::className, style, linkStyle, or classDef. These will not render correctly and can cause errors.

Use Diamonds for Decisions
To represent conditions like true/false or yes/no, use diamond shapes by wrapping the label in curly braces, like E{"Is main thread?"}.

Stick to ASCII Characters
Avoid using emojis, smart quotes (“ ”), non-ASCII punctuation, or other special Unicode characters. Stick to standard keyboard symbols for maximum compatibility.

Use Consistent Quote Styles
Always use matching single (') or double (") quotes around your node labels. Do not mix the two. For example, ["Text"] or ['Text'] are both valid, but ["Text'] is not.

Avoid Unescaped Quotes Inside Labels
If your label includes quotes, make sure you escape them if necessary or switch quote styles. For example, instead of writing ["Update job status to \"allocated\""], use ['Update job status to "allocated"'] or ["Update job status to 'allocated'"].

Avoid Special Characters in Node Labels
Characters like parentheses (), brackets [], or additional quotes within the label can confuse the parser if not handled properly. It’s best to use descriptive text and avoid raw syntax. For example, instead of ["allocateAndProgress()"], write ["allocateAndProgress"].

Don’t Use Raw Function Calls in Labels
While it’s tempting to include code like setupAiJob(jobClassObject) directly in a label, this can break parsing. Instead, phrase it descriptively, such as ["Call setupAiJob with jobClassObject"].

Subgraphs Must Be Properly Formatted
Every subgraph should start with a clear label in quotes and end with end. Keep internal nodes within that subgraph consistent with the same rules above—especially regarding quote usage.
`;

const GENERATION_SYSTEM_PROMPT = `
You are an expert system architecture and flowchart generator.
Your task is to create high-quality Mermaid code from a user prompt.

You MUST follow these strict rules to ensure Excalidraw and standard parser compatibility:
${MERMAID_GUIDE}

Output ONLY the raw mermaid code, preferably wrapped in a \`\`\`mermaid block. Do not include any other explanations, thoughts, or conversational text.
`.trim();

const REVIEW_SYSTEM_PROMPT = `
You are a strict Quality Assurance reviewer for Mermaid diagrams.
Review the provided Mermaid code against the following formatting rules:
${MERMAID_GUIDE}

Identify any syntax errors, unescaped characters, unsupported node types, or CSS/styling blocks. 
Fix them silently. Return ONLY the fully corrected, raw Mermaid code wrapped in a \`\`\`mermaid block. Do not include any explanations or conversational text.
`.trim();

export const details = {
    toolName: "createMermaidDiagram",
    version: "1.0.0",
    creator: "TheHive",
    overview: "Generates high-quality, parser-compatible Mermaid flowchart code based on user instructions. It automatically reviews and corrects its own syntax to ensure it adheres to strict limitations (e.g., no HTML, strict quote usage). Limitations: Only supports basic flowcharts (TD/LR); does not support Gantt, sequence, or advanced styling.",
    guide: "Pass the descriptive instructions for the diagram in the 'prompt' parameter. The resulting code can be directly rendered or imported into tools like Excalidraw.",
    inputSchema: JSON.stringify({
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "The specific instructions or description of the diagram to be generated."
            }
        },
        "required": ["prompt"],
        "additionalProperties": false
    })
};

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

/**
 * Executes the Mermaid Code Generator logic.
 * 
 * @param {object} Shared - Core Hive services injected by the system
 * @param {object} params - Inputs defined in inputSchema
 * @returns {Promise<object>} - A Shared.Utils.Ok or Shared.Utils.Err Result
 */
export async function run(Shared, params = {}, agent = {}) {
    const { prompt } = params;
    const { aiSettings = {} } = agent || {};

    if (!prompt || typeof prompt !== 'string') {
        return Shared.v2Core.Helpers.Err("Error (createMermaidDiagram): 'prompt' parameter is strictly required and must be a string.");
    }

    try {
        safeEmit(agent, `Charting and drawing...`);
        // Instantiate the standard AI Caller service
        const aiCall = await Shared.callAI.aiFactory();

        // Step 1: Generate initial diagram
        const userPrompt = `Here are your instructions: <prompt>${prompt}</prompt>\nReturn only the Mermaid code.`;
        
        const generationResponse = await aiCall.generateText(userPrompt, GENERATION_SYSTEM_PROMPT, { ...aiSettings, quality: 3 });
        if (generationResponse.isErr()) {
            return Shared.v2Core.Helpers.Err(`AI Call failed during Mermaid generation step: ${generationResponse.value}`);
        }
        safeEmit(agent, `Sharpening pencil.. `);
        const rawGeneratedCode = extractCodeBlock(generationResponse.value);

        // Step 2: Critic / Review Phase
        const reviewPrompt = `Review this mermaid code for errors and fix any that you find:\n\n\n${rawGeneratedCode}`;
        
        safeEmit(agent, `Checking my work...`);
        const reviewResponse = await aiCall.generateText(reviewPrompt, REVIEW_SYSTEM_PROMPT, { ...aiSettings, quality: 3 });
        if (reviewResponse.isErr()) {
            return Shared.v2Core.Helpers.Err(`AI Call failed during Mermaid review step: ${reviewResponse.value}`);
        }

        const finalMermaidCode = extractCodeBlock(reviewResponse.value);

        // Step 3: Prepare standardized Tool output
        const resultData = {
            success: true,
            mermaidCode: finalMermaidCode,
            timestamp: new Date().toISOString()
        };
        const message = new Shared.aiAgents.Classes.DataMessage({
            role: Shared.aiAgents.Constants.Roles.Tool,
            data: resultData,
            ext: "json",
            toolName: details.toolName,
            instructions: "Present the generated Mermaid code to the user or process it for rendering."
        });
        if (agent && typeof agent.addAiCount === 'function') {
            agent.addAiCount(2);
        }
        return Shared.v2Core.Helpers.Ok([message]);

    } catch (error) {
        return Shared.v2Core.Helpers.Err(`Critical execution error in ${details.toolName}: ${error.message}`);
    }
}

/**
 * Pure function to extract Mermaid code from markdown formatting.
 * 
 * @param {string} text - The raw AI output
 * @returns {string} - The clean extracted code
 */
function extractCodeBlock(text) {
    if (!text) return "";
    
    const blockRegex = /```(?:mermaid)?\n([\s\S]*?)```/;
    const match = text.match(blockRegex);
    
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // Fallback if AI forgot to wrap in a markdown block
    return text.trim();
}
