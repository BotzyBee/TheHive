/*
    Uses The Hive Plugin Tool Standard
    Orchestrator Version: Skeleton + SuperEditor Driver
*/
export const details = {
    toolName:   "createCodeTool",
    version:    "2026.4.0",
    creator:    "Botzy Bee",
    overview:   "This tool uses AI to create, check or modify code. It can also answer queries about coding or code."+
    " The Tool can output in a range of common code languages - for example HTML, Javascript, python, rust, CSS.  \n"+
    " Great for frontend or backend development. This tool DOES NOT execute code.",
    guide: null,
    inputSchema: {
        "type": "object",
        "properties": {
            "taskDescription": { "type": "string", "description": "The coding task." },
            "context": { "type": "string", "description": "Reference context." }
        },
        "required": ["taskDescription"]
    }
};

export async function run(Shared, params = {}) {
    const { taskDescription, context } = params;
    const aiCall = new Shared.AiCall.AiCall();
    const superEditor = Shared.CoreTools.AgentCompatible.superEditor.run; 
    let retAR = [];

    // [][] --- STEP 1: ARCHITECT THE SKELETON --- [][]

    const archSys = "You are a Software Architect. Create a valid file SKELETON. " +
        "Include all boilerplate, imports, and function signatures. " +
        "Inside every empty function or logic block, put a unique marker like '// [INJECT_1]', '// [INJECT_2]'. " +
        "Return a JSON list of what each marker should contain." +
        `Here is any context: \n ${context} \n`;

    const archSchema = {
        "type": "object",
        "properties": {
            "mimeType": { "type": "string" },
            "skeleton": { "type": "string" },
            "workOrders": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "marker": { "type": "string" },
                        "description": { "type": "string", "description": "Detailed logic requirements for this marker." }
                    }
                }
            }
        },
        "required": ["mimeType", "skeleton", "workOrders"]
    };

    const archCall = await aiCall.generateCode(archSys, taskDescription, {structuredOutput : archSchema});
    if (archCall.isErr()) return Shared.Utils.Err(`Error (createCodeTool -> Architecture phase) : Architecture phase failed. ${archCall.value}`);

    let _save = await Shared.FileSystem.saveFile('./', archCall.value.skeleton, 'skeleton.txt'); // TEMP - for debugging
    let currentFileState = archCall.value.skeleton;
    const mimeType = archCall.value.mimeType;
    const orders = archCall.value.workOrders;

    // [][] --- STEP 2 & 3: GENERATE & INJECT (LOOP) --- [][]

    for (const order of orders) {
        // A: Generate the specific logic snippet
        const devSys = `You are a Senior Developer. Write ONLY the code required for ${order.marker}. ` +
                       `Requirement: ${order.description}. ` +
                       `Context: You are working within this file skeleton:\n${currentFileState}`+
                       `Your goal is to produce 'production-ready' code that balances immediate functionality with long-term maintainability. `+
                       `Include error handling, guard clauses, edge-case validation, and clear logging. Write expressive variable names. Add comments only to explain 'why,' not 'what.'`+
                       `Here is any additional context: \n ${context} \n`;
        
        const devCall = await aiCall.generateCode(devSys, "Output ONLY the raw code logic. No markdown. No preamble.");
        if (devCall.isErr()){ return Shared.Utils.Err(`Error (createCodeTool -> Development phase) : ${devCall.value}`)}

        const generatedSnippet = devCall.value;

        // B: Use superEditor to inject the generated snippet into the correct place in the skeleton
        const editorPrompt = `REPLACE the marker '${order.marker}' with the code provided in the context.`;

        const editResult = await superEditor(Shared, {
            prompt: editorPrompt,
            document: currentFileState,
            context: generatedSnippet
        });
        if (editResult.isErr()){ return Shared.Utils.Err(`Error (createCodeTool -> SuperEditor phase) : ${editResult.value}`)}

        // Unpack the data message returned by superEditor
        const editData = editResult.value[0].data;
        currentFileState = editData.editedDocument;
        let _save = await Shared.FileSystem.saveFile('./', currentFileState, `edit_${order.marker}.txt`); // TEMP - for debugging
    }

    // [][] --- FINAL OUTPUT --- [][]
    retAR.push(new Shared.Classes.TextMessage({
        role: Shared.Classes.Roles.Tool,
        mimeType: mimeType,
        textData: currentFileState,
        toolName: "createCodeTool",
        instructions: "Final Refined Code Assembly Complete"
    }));

    return Shared.Utils.Ok(retAR);
}