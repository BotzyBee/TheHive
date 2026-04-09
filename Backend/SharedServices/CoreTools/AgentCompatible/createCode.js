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
    const superEditor = new Shared.CoreTools.SuperEditor(); 
    let retAR = [];

    // [][] --- STEP 1: ARCHITECT THE SKELETON --- [][]

    const archSys = "You are a Software Architect. Create a valid file SKELETON. " +
        "Include all boilerplate, imports, and function signatures. " +
        "Inside every empty function or logic block, put a unique marker like '// [INJECT_1]', '// [INJECT_2]'. " +
        "Return a JSON list of what each marker should contain.";

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
                       `Include error handling, edge-case validation, and clear logging. Write expressive variable names. Add comments only to explain 'why,' not 'what.'`;
        
        const devCall = await aiCall.generateText(devSys, "Output ONLY the raw code logic. No markdown. No preamble.");
        
        if (devCall.isOk()) {
            const generatedSnippet = devCall.value;

            // B: Command the "Dumb" SuperEditor to perform the swap
            // We give it a literal, unambiguous command.
            const editorPrompt = `REPLACE the marker '${order.marker}' with the following code:\n\n${generatedSnippet}`;

            const editResult = await superEditor.run(Shared, {
                prompt: editorPrompt,
                document: currentFileState,
                context: `Targeting marker ${order.marker} for task: ${taskDescription}`
            });

            if (editResult.isOk()) {
                // Assuming DataMessage contains the updated document in its 'data' payload
                const editData = editResult.value[0].data;
                if (editData.success) {
                    currentFileState = editData.editedDocument;
                    retAR.push(new Shared.Classes.TextMessage({
                        role: Shared.Classes.Roles.Assistant,
                        textData: `Successfully injected logic into ${order.marker}`,
                        toolName: "createCodeTool"
                    }));
                }
            }
        }
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