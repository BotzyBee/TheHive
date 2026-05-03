/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
  toolName: 'calculatorTool',
  version: '2026.0.1',
  creator: 'Botzy Bee',
  overview:
    'A tool for calculating a valid mathematical expression string. Supports +, -, *, /, brackets, and decimals. ' +
    'Example : (1 + 3) / 2). This tool acts as a calculator. The tool cannot perform any other function. ' +
    'Only use this tool when you need to calculate a math expression. If the expression is invalid, the tool will return an error message. ',
  guide:
    "Do not include text such as 'Calculate' or 'What is' in the expression parameter. Only provide the raw math expression. " +
    'The tool will return the result of the expression. If the expression is invalid, the tool will return an error message. ' +
    'Use this tool when you need to calculate a math expression. Do not use this tool for any other purpose. ' +
    'If the expression is invalid, the tool will return an error message. ' +
    'Example of valid expression: (1 + 3) / 2). Example of invalid expression: Calculate (1 + 3) / 2).',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description:
          "The math expression that will be calculated. For example '(1 + 3) / 2)'",
      },
    },
    required: ['expression'],
    additionalProperties: false,
  },
};

function safeEmit(agent, message) {
  if (agent && typeof agent.emitUpdateStatus === 'function') {
    agent.emitUpdateStatus(message);
  }
}

/**
 * Calculates the value based on math expression.
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services'
 * @param {object}  options
 * @param {string}  options.expression - The expression to be calculated. For example '(1 + 3) / 2)'
 * @returns {Result[ [TextMessage ] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run(Shared, params = {}, agent = {}) {
  safeEmit(agent, `Bashing some numbers.. 🤓`);
  // Destructure input
  let { expression } = params;

  // catch bad params
  if (
    expression == null ||
    typeof expression !== 'string' ||
    expression.trim() === ''
  ) {
    return Shared.v2Core.Helpers.Err(
      `Error (calculatorTool): Missing or invalid 'expression' parameter.`
    );
  }

  try {
    // Evaluate using mathjs
    const result = Shared.aiAgents.ToolHelpers.evaluateHelper(expression);
    let message = new Shared.aiAgents.Classes.TextMessage({
      role: Shared.aiAgents.Constants.Roles.Tool,
      mimeType: 'text/plain',
      textData: `The result of '${expression}' is ${result}`,
      toolName: 'calculatorTool',
      instructions: `Calculate ${expression}`,
    });
    return Shared.v2Core.Helpers.Ok([message]);
  } catch (error) {
    return Shared.v2Core.Helpers.Err(
      `Error (calculatorTool -> mathjs.evaluate): ${error.message || error}`
    );
  }
}
