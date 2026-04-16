/*
    Uses The Hive Plugin Tool Standard
    Orchestrator Version: Multi-Modal (Router -> Skeleton / Editor / Reviewer)
*/
export const details = {
    toolName:   "createCodeTool",
    version:    "2026.5.1",
    creator:    "Botzy Bee",
    overview:   "This tool uses AI to create, edit, or review code. \n" +
                "- CREATE: Builds new code from scratch using an architectural skeleton.\n" +
                "- EDIT: Modifies existing code provided in the 'codeForProcessing' field.\n" +
                "- REVIEW: Analyzes code to find bugs, suggest improvements, or answer questions.\n" +
                "The Tool can output in a range of common code languages. This tool DOES NOT execute code." + 
                "Code text can be identified by the use of terms such as function, var, let, const, class, def, import, include, #include, package, public, private, protected, void, int, string, etc. " +
                "The tool can also output markdown formatted text for code reviews or explanations.",
    guide: 
`There are 3 different tasks that this tool can perform. What parameters you use will depend on the task.

- CREATE: Builds new code from scratch using an architectural skeleton. When using this mode you must provide a clear 'taskDescription'. 
If the user provided any context or guides they can be included via 'contextOrGuides' parameter.

- EDIT: Modifies existing code provided in the 'codeForProcessing' field. When using this option you must a clear 'taskDescription' and 'codeForProcessing' (the code that will be edited).
If the user provided any context or guides they can be included via 'contextOrGuides' parameter.

- REVIEW: Analyses code to find bugs, suggest improvements, or answer questions. You must provide a 'taskDescription' and put the code needing reviewed in 'codeForProcessing'. 
If the user provided any context or guides they can be included via 'contextOrGuides' parameter.`,
    inputSchema: {
        "type": "object",
        "properties": {
            "taskDescription": { "type": "string", "description": "The coding task, request, or question." },
            "codeForProcessing": { "type": "string", "description": "The specific code needing edited. Not needed if code generation or code review is requested." },
            "contextOrGuides": { "type": "string", "description": "Reference context - this can be text or other code which will help the agent." }
        },
        "required": ["taskDescription"]
    }
};

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

export async function run(Shared, params = {}, agent = {}) {
    const { taskDescription, codeForProcessing = "", contextOrGuides = "" } = params;
    const { aiSettings = {} } = agent || {};
    let aiCount = 0;
    console.log("AI SETTINGS ", JSON.stringify(aiSettings, null, 2));

    const aiCall = Shared.callAI.aiFactory();
    const superEditor = Shared.aiAgents.AgentTools.superEditor.run; 
    let retAR = [];

    // [][] --- STEP 0: ROUTER PHASE --- [][]
    // Determine what the user actually wants to do with the code.

    const routerSys = "You are a routing agent for a coding tool. Based on the user's task description and whether context is provided, determine the mode of operation:\n" +
                      "- 'CREATE': The user wants to build new code or a new file from scratch.\n" +
                      "- 'EDIT': The user wants to modify, update, or refactor existing code provided in the context.\n" +
                      "- 'REVIEW': The user is asking a question about the code, looking for bugs, or wants an opinion/explanation (text response only).";

    const routerSchema = {
        "type": "object",
        "properties": {
            "mode": { 
                "type": "string", 
                "enum": ["CREATE", "EDIT", "REVIEW"],
                "description": "The selected execution mode."
            }
        },
        "required": ["mode"]
    };
    safeEmit(agent, "Coding Tool 🖥️ : Setting things up...");
    const routerCall = await aiCall.generateCode(routerSys, `Task: ${taskDescription}`, { ...aiSettings, structuredOutput: routerSchema });
    if (routerCall.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> Router phase) : ${routerCall.value}`);
    aiCount++;

    const mode = routerCall.value.mode;

    // [][] --- EXECUTE BASED ON MODE --- [][]

    if (mode === "REVIEW") {
        safeEmit(agent, "Coding Tool 🖥️ :: Reviewing the user provided code...");
        // --- MODE: REVIEW (Text/Analysis Output) ---
        const reviewSys = "You are an expert Senior Developer. Review the provided code based on the user's task description. " +
                          "Provide clear, concise, and insightful analysis. Point out bugs, security flaws, or performance issues if asked. " +
                          "Output your response in standard markdown format (not raw code).";
        
        const reviewCall = await aiCall.generateCode(
            reviewSys, 
            `Task: ${taskDescription}\n\nCode to Review:\n${codeForProcessing}. \n\n Code or Guide Context (may be empty): \n ${contextOrGuides}`,
            aiSettings
        );
        if (reviewCall.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> Review phase) : ${reviewCall.value}`);
        aiCount++;
        retAR.push(new Shared.aiAgents.Classes.TextMessage({
            role: Shared.aiAgents.Constants.Roles.Tool,
            mimeType: "text/markdown",
            ext: "md",
            textData: reviewCall.value,
            toolName: "createCodeTool",
            instructions: "Code review and analysis complete."
        }));
        if(agent) agent.addAiCount(aiCount);
        return Shared.v2Core.Helpers.Ok(retAR);
    }

if (mode === "EDIT") {
        safeEmit(agent, "Coding Tool 🖥️ :: Creating a list of specific edits...");
        // --- MODE: EDIT (Modify Existing Code) ---
        if (!codeForProcessing || codeForProcessing === "") {
             return Shared.v2Core.Helpers.Err("Error: EDIT mode selected by router, but no existing code was provided in the context.");
        }

        // 1. Generate an Edit Plan
        const editPlanSys = "You are a Senior Developer. Review the existing code and the user's edit request. " +
                            "Break down the required changes into a sequence of distinct, logical edits. " +
                            "For each edit, provide a clear instruction for a 'dumb' text replacement tool and the EXACT new code snippet that needs to be inserted, added, or replaced. " +
                            "Ensure the code snippets are production-ready and contain no markdown wrappers."+
                            "You will be provided with the code for editing and may also be provided with context (guides or example code)"+
                            "You must also output the file extension for the file being created or edited - 'js' 'html' 'rs' etc. This is to ensure that the code created matches the saved format.";

        const editPlanSchema = {
            "type": "object",
            "properties": {
                "edits": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "instruction": { "type": "string", "description": "Specific instruction for the editor, e.g., 'Replace the calculateTotal function with the provided code' or 'Insert the provided imports at the top of the file'." },
                            "codeSnippet": { "type": "string", "description": "The raw code snippet to be inserted or swapped in. Provide ONLY the raw code." }
                        }
                    }
                },
                "ext": { "type": "string" },
            },
            "required": ["edits", "ext"]
        };

        const editPlanCall = await aiCall.generateCode(
            editPlanSys, 
            `Task: ${taskDescription}\n\nCode to Edit:\n${codeForProcessing}. \n\n <context>${contextOrGuides}</context>`, 
            { ...aiSettings, structuredOutput: editPlanSchema }
        );
        aiCount++;
        if (editPlanCall.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> Edit Plan phase) : ${editPlanCall.value}`);

        let currentFileState = codeForProcessing;
        const edits = editPlanCall.value.edits;
        const ext = editPlanCall.value.ext;

        // 2. Loop through the plan and use superEditor for each targeted change
        for (const [index, edit] of edits.entries()) {
            safeEmit(agent, `Coding Tool 🖥️ :: Applying edit - ${index + 1} of ${edits.length}...`);
            const editResult = await superEditor(Shared, {
                prompt: edit.instruction,
                document: currentFileState,
                context: edit.codeSnippet // Pass the newly generated code snippet as context for the editor
            }, agent);
            if (editResult.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> SuperEditor Edit phase) : ${editResult.value}`);

            // Update the working document for the next iteration
            currentFileState = editResult.value[0].data.editedDocument;
        }

        // 3. Output the final modified document
        retAR.push(new Shared.aiAgents.Classes.TextMessage({
            role: Shared.aiAgents.Constants.Roles.Tool,
            ext: ext,
            textData: currentFileState,
            toolName: "createCodeTool",
            instructions: "Iterative code modifications complete."
        }));
        if(agent) agent.addAiCount(aiCount);
        return Shared.v2Core.Helpers.Ok(retAR);
    }

    if (mode === "CREATE") {
        safeEmit(agent, "Coding Tool 🖥️ :: Creating new code...");
        // --- MODE: CREATE (Skeleton + Injector Orchestrator) ---
        const archSys = "You are a Software Architect. Create a valid file SKELETON. " +
            "Include all boilerplate, imports, and function signatures. " +
            "Inside every empty function or logic block, put a unique marker like '// [INJECT_1]', '// [INJECT_2]'. " +
            "Return a JSON list of what each marker should contain." +
            "You must also output a file extension - eg 'js' 'html' 'rs' so that the created code is saved as the correct file type."+
            `Here is any context: \n ${contextOrGuides} \n`;

        const archSchema = {
            "type": "object",
            "properties": {
                "ext": { "type": "string" },
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
            "required": ["ext", "skeleton", "workOrders"]
        };

        safeEmit(agent, "Coding Tool 🖥️ :: Planning the structure...");
        const archCall = await aiCall.generateCode(archSys, taskDescription, { ...aiSettings, structuredOutput : archSchema});
        if (archCall.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> Architecture phase) : Architecture phase failed. ${archCall.value}`);
        aiCount++;
        let currentFileState = archCall.value.skeleton;
        const extType = archCall.value.ext;
        const orders = archCall.value.workOrders;

        // Generate & Inject Loop
        for (const [index, order] of orders.entries()) {
            safeEmit(agent, `Coding Tool 🖥️ :: Generating code for marker (${index + 1} of ${orders.length})...`);
            const devSys = `You are a Senior Developer. Write ONLY the code required for ${order.marker}. ` +
                           `Requirement: ${order.description}. ` +
                           `Context: You are working within this file skeleton:\n${currentFileState}\n`+
                           `Your goal is to produce 'production-ready' code that balances immediate functionality with long-term maintainability. `+
                           `Include error handling, guard clauses, edge-case validation, and clear logging. Write expressive variable names. Add comments only to explain 'why,' not 'what.'`+
                           `Here is any additional context: \n ${contextOrGuides} \n`;
            
            const devCall = await aiCall.generateCode(devSys, "Output ONLY the raw code logic. No markdown. No preamble.", aiSettings);
            if (devCall.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> Development phase) : ${devCall.value}`);
            aiCount++;
            const generatedSnippet = devCall.value;
            const editorPrompt = `REPLACE the marker '${order.marker}' with the code provided in the context.`;

            safeEmit(agent, `Coding Tool 🖥️ :: Applying new code to document...`);
            const editResult = await superEditor(Shared, {
                prompt: editorPrompt,
                document: currentFileState,
                context: generatedSnippet
            }, agent);

            if (editResult.isErr()) return Shared.v2Core.Helpers.Err(`Error (createCodeTool -> SuperEditor phase) : ${editResult.value}`);

            const editData = editResult.value[0].data;
            currentFileState = editData.editedDocument;
        }

        retAR.push(new Shared.aiAgents.Classes.TextMessage({
            role: Shared.aiAgents.Constants.Roles.Tool,
            ext: extType,
            textData: currentFileState,
            toolName: "createCodeTool",
            instructions: "Final Refined Code Assembly Complete"
        }));
        if (agent && typeof agent.addAiCount === 'function') {
            agent.addAiCount(aiCount);
        }
        return Shared.v2Core.Helpers.Ok(retAR);
    }
    
    return Shared.v2Core.Helpers.Err("Error: Router failed to select a valid mode.");
}