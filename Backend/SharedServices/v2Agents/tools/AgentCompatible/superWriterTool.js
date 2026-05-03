/**
 * 🐝 TheHive Plugin Tool Standard - Super Writer Tool
 * This tool requires the superEditor tool !! Ensure this is available in AgentCompatable tools.
 */

export const details = {
  toolName: 'superWriterTool',
  version: '1.0.0',
  creator: 'Hive Architect',
  overview:
    'A sophisticated AI writing tool that generates, edits, and iteratively refines text documents.',
  guide:
    "Provide a 'taskDescription' outlining what needs to be written or edited. Provide an 'initialDocument' if modifying existing text. Provide 'contextOrGuides' for stylistic or factual references.",
  inputSchema: JSON.stringify({
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: 'The writing task, request, or edit instruction.',
      },
      initialDocument: {
        type: 'string',
        description:
          'The starting text document. Leave empty if generating from scratch.',
      },
      contextOrGuides: {
        anyOf: [
          { type: 'string' },
          {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'object' }] },
          },
        ],
        description:
          'Reference context, facts, or stylistic guidelines. Can be a string, or an array of strings/objects.',
      },
    },
    required: ['taskDescription'],
    additionalProperties: false,
  }),
};

function safeEmit(agent, message) {
  if (agent && typeof agent.emitUpdateStatus === 'function') {
    agent.emitUpdateStatus(message);
  }
}

/**
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 * @param {object} agent - Optional agent object
 */
export async function run(Shared, params = {}, agent = {}) {
  try {
    const {
      taskDescription,
      initialDocument = '',
      contextOrGuides = '',
    } = params;

    // Prevent crashes if the agent object is partially initialised or missing
    const aiSettings = agent?.aiSettings || {};

    let aiCount = 0;
    const aiFactory = await Shared.callAI.aiFactory();
    const superEditor = Shared.aiAgents.AgentTools.superEditor.run;

    // Fail fast if the primary driving input is missing or empty, as the AI needs clear instructions to operate
    if (
      !taskDescription ||
      typeof taskDescription !== 'string' ||
      taskDescription.trim() === ''
    ) {
      return Shared.v2Core.Helpers.Err(
        "Validation Error: 'taskDescription' is required and must be a non-empty string."
      );
    }

    let workingDocument = initialDocument;
    let contexts = [];

    if (Array.isArray(contextOrGuides)) {
      contexts = contextOrGuides.map((c) =>
        typeof c === 'string' ? c : JSON.stringify(c)
      );
    } else if (contextOrGuides) {
      contexts = [
        typeof contextOrGuides === 'string'
          ? contextOrGuides
          : JSON.stringify(contextOrGuides),
      ];
    }

    if (contexts.length === 0) {
      contexts = [''];
    }

    // [][] --- LOOP OVER CONTEXT DOCUMENTS --- [][]

    for (let i = 0; i < contexts.length; i++) {
      const currentContext = contexts[i];

      // [][] --- INIT DOCUMENT IF NOT PROVIDED BY USER --- [][]

      if (i === 0 && (!workingDocument || workingDocument.trim() === '')) {
        safeEmit(agent, 'Super Writer 📝 : Generating initial base draft...');

        const draftSystem =
          'You are an expert copywriter and technical author. Generate a comprehensive base draft focusing on core structure and content. Do not output markdown code blocks unless requested.';
        const draftUser = `Task: ${taskDescription}\n\nContext/Guides:\n${currentContext}`;

        const draftCall = await aiFactory.generateText(
          draftSystem,
          draftUser,
          aiSettings
        );

        if (draftCall.isErr()) {
          return Shared.v2Core.Helpers.Err(
            `Error (superWriterTool -> Initial Draft) : ${draftCall.value}`
          );
        }

        workingDocument = draftCall.value;
        aiCount += 1;
      }

      // Structuring the edit plan ensures the LLM tackles revisions sequentially and logically,
      // avoiding overwhelming single-pass edits that often lead to dropped requirements.
      safeEmit(
        agent,
        `Super Writer 📝 : Analysing document to create an iterative edit plan (Context ${i + 1} of ${contexts.length})...`
      );

      const editPlanSchema = {
        type: 'object',
        properties: {
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                instruction: {
                  type: 'string',
                  description:
                    "Specific instruction for the editor, e.g., 'rewrite the introduction to be more formal' or 'insert factual context about X'.",
                },
              },
              required: ['instruction'],
            },
          },
        },
        required: ['edits'],
      };

      // [][] --- GENERATE EDITS --- [][]
      const editPlanSystem =
        'You are a Master Editor. Analyse the provided working document against the original task and context. Break down necessary improvements into a sequence of isolated, highly specific editing instructions. If the document already meets all requirements, output an empty array.';
      const editPlanUser = `Task: ${taskDescription}\nContext/Guides: ${currentContext}\n\nCurrent Document:\n${workingDocument}`;

      const editPlanCall = await aiFactory.generateCode(
        editPlanSystem,
        editPlanUser,
        { ...aiSettings, structuredOutput: editPlanSchema }
      );

      if (editPlanCall.isErr()) {
        return Shared.v2Core.Helpers.Err(
          `Error (superWriterTool -> Edit Plan) : ${editPlanCall.value}`
        );
      }
      aiCount += 1;

      const edits = editPlanCall.value.edits || [];

      // [][] --- USE SUPER EDITOR TO COMPLETE EDITS --- [][]

      if (edits.length > 0) {
        safeEmit(
          agent,
          `Super Writer 📝 : Executing ${edits.length} iterative edits for context ${i + 1}...`
        );

        for (const [index, edit] of edits.entries()) {
          safeEmit(
            agent,
            `Super Writer 📝 : Applying edit ${index + 1} of ${edits.length} (Context ${i + 1})...`
          );

          const editResult = await superEditor(
            Shared,
            {
              prompt: edit.instruction,
              document: workingDocument,
              context: currentContext,
            },
            agent
          );

          if (editResult.isErr()) {
            return Shared.v2Core.Helpers.Err(
              `Error (superWriterTool -> SuperEditor Edit ${index + 1}) : ${editResult.value}`
            );
          }

          const editData = editResult.value[0]?.data;

          // Fail fast if the internal editor contract is broken to prevent data corruption
          if (!editData || typeof editData.editedDocument !== 'string') {
            return Shared.v2Core.Helpers.Err(
              `Error (superWriterTool) : Unexpected malformed response from superEditor on iteration ${index + 1}.`
            );
          }

          workingDocument = editData.editedDocument;
        }
      } else {
        safeEmit(
          agent,
          `Super Writer 📝 : Document meets requirements. No further edits needed for context ${i + 1}.`
        );
      }
    }

    // Track agent count
    if (agent && typeof agent.addAiCount === 'function') {
      agent.addAiCount(aiCount);
    }

    const finalMessage = new Shared.aiAgents.Classes.TextMessage({
      role: Shared.aiAgents.Constants.Roles.Tool,
      mimeType: 'text/markdown',
      ext: 'md',
      textData: workingDocument,
      toolName: details.toolName,
      instructions:
        'Iterative writing and editing complete. Present the finalised markdown text to the user.',
    });

    return Shared.v2Core.Helpers.Ok([finalMessage]);
  } catch (error) {
    return Shared.v2Core.Helpers.Err(
      `Error in ${details.toolName}: ${error.message}`
    );
  }
}
