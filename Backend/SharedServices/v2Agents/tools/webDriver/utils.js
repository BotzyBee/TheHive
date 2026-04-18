// import { JSDOM } from 'jsdom';
// import { Ok, Err } from '../../Utils/helperFunctions.js';

// /**
//  * Cleans an HTML string and extracts unique URLs.
//  * @param {string} htmlString - The raw HTML content.
//  * @param {string} baseUrl - Required to resolve relative links and compute styles properly.
//  */
// export async function cleanHtmlString(htmlString, baseUrl = 'http://localhost') {
//     try {
//         const dom = new JSDOM(htmlString, { url: baseUrl });
//         const { document } = dom.window;

//         // 1. Heavy Pruning
//         const junkTags = ['style', 'script', 'svg', 'iframe', 'noscript', 'canvas', 'video', 'audio', 'head'];
//         const junkAttrs = ['[aria-hidden="true"]', '[hidden]', '[style*="display: none"]'];
//         document.querySelectorAll([...junkTags, ...junkAttrs].join(', ')).forEach(el => el.remove());

//         // 2. Interactive Attribute Whitelist
//         const keeperAttrs = [
//             'id', 'name', 'type', 'placeholder', 'aria-label', 
//             'role', 'href', 'value', 'data-testid', 'data-nav-id'
//         ];

//         // 3. Process Elements
//         const allElements = document.querySelectorAll('body *');
//         allElements.forEach((el, index) => {
//             const tagName = el.tagName.toLowerCase();
//             const isInteractive = ['button', 'a', 'input', 'textarea', 'select', 'option'].includes(tagName);
            
//             // Assign a unique "Action ID" to every interactive element
//             // This is the ONLY selector the AI should ideally use.
//             if (isInteractive) {
//                 el.setAttribute('data-nav-id', `ix-${index}`);
//             }

//             // Strip non-essential attributes
//             for (let i = el.attributes.length - 1; i >= 0; i--) {
//                 const attrName = el.attributes[i].name;
//                 if (!keeperAttrs.includes(attrName)) {
//                     el.removeAttribute(attrName);
//                 }
//             }

//             // Remove empty non-interactive containers (reduces noise)
//             if (!isInteractive && !el.textContent.trim() && !el.children.length) {
//                 el.remove();
//             }
//         });

//         // 4. Final Polish
//         let cleaned = document.body.innerHTML
//             .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
//             .replace(/\s+/g, ' ')            // Minify whitespace
//             .trim();

//         return Ok(cleaned);

//     } catch (error) {
//         return Err(`Error (cleanHtmlString) : ${error.message}`);
//     }
// }

// /**
//  * Smart extractor that uses an AI decision engine to determine the best extraction method.
//  * @param {string} htmlString - The raw HTML of the webpage.
//  * @param {string} userRequest - The user's prompt (e.g., "Fetch XYZ data from XY website").
//  * @param {Object} agent - The AI agent instance. 
//  * Returns { extractedData: any } || string - Result object with either extracted data or an error message.
//  */
// export async function smartExtractData(htmlString, userRequest, agent) {
//     // 1. The AI evaluates the HTML and the user's request.
//     // It must return an object matching the decision schema (see below).
//     const aiDecision = await agent.generateText(
//         PromptsAndSchemas.extractorDecision.sys,
//         PromptsAndSchemas.extractorDecision.usr(userRequest, htmlString),
//         { structuredOutput: PromptsAndSchemas.extractorDecision.schema }
//     );
//     if(aiDecision.isErr()) {
//         return Err(`Error (smartExtractData) : AI decision failed ${JSON.stringify(aiDecision.value)}`);
//     }   

//     // 2. Route based on the AI's decision
//     if (aiDecision.value.action === 'return_data') {
//         // The AI was able to extract the data directly from the HTML
//         console.log("AI decided to return data directly:");
//         return Ok({ extractedData: aiDecision.value.extractedData });
//     } 
//     else if (aiDecision.value.action === 'use_dom') {
//         // The AI decided the data is too large/structured and provided a selector
//         console.log("AI decided to use DOM extraction with params:", aiDecision.value.domParams);
//         const domResult = await extractWithDOM(htmlString, aiDecision.value.domParams);
//         return domResult.isErr() ? Err(`Error (smartExtractData) : ${JSON.stringify(domResult.value)}`) : Ok({ extractedData: domResult.value });
//     } 
//     else {
//         return Err(`Error (smartExtractData) : Unrecognized AI action: ${JSON.stringify(aiDecision.value.action)}`);
//     }
// }

// /**
//  * Helper function for direct DOM extraction.
//  */
// async function extractWithDOM(htmlString, domParams) {
//     try {
//         const { selector, extractType = 'html' } = domParams;
//         const dom = new JSDOM(htmlString);
//         const document = dom.window.document;
//         const element = document.querySelector(selector);

//         if (!element) {
//             return Err(`Error (extractWithDOM) : No element found for selector "${selector}"`);
//         }

//         let extractedData;
//         switch (extractType) {
//             case 'text':
//                 extractedData = element.textContent.trim();
//                 break;
//             case 'outerHtml':
//                 extractedData = element.outerHTML;
//                 break;
//             case 'html':
//             default:
//                 extractedData = element.innerHTML;
//                 break;
//         }

//         return Ok(extractedData);

//     } catch (error) {
//         return Err(`Error (extractWithDOM) : DOM extraction failed : ${error.message}`);
//     }
// }

// export const PromptsAndSchemas = {
//     extractorDecision: {
//         sys: `You are a specialised HTML Extraction Router. Your goal is to fulfill a user's data request from a provided HTML string using the most efficient method.

// ### METHOD SELECTION RULES:

// 1. **USE "return_data" (Direct Extraction) IF:**
//    - The requested data is a specific, short value (e.g., a price, a date, a single name, a phone number).
//    - The answer is a short summary or a single sentence.
//    - The data is scattered in a way that a single CSS selector cannot capture it easily.

// 2. **USE "use_dom" (DOM Lifting) IF:**
//    - The requested data is a large block of text (e.g., a full article body, a product description).
//    - The data is highly structured (e.g., an entire HTML table, a long list of items).
//    - The user needs to preserve the HTML formatting/tags.
//    - The content is likely to exceed 150-200 words.

// ### DOM PARAMETER GUIDELINES:
// - **selector**: Provide a precise CSS selector (id, class, or tag hierarchy).
// - **extractType**: 
//     - Use "text" for plain content.
//     - Use "html" for inner content with tags.
//     - Use "outerHtml" if the container tag itself is needed.`,

//         usr: (userRequest, htmlString) => {
//             return `USER REQUEST: "${userRequest}"\n\nHTML CONTENT:\n${htmlString}`;
//         },

//         schema: {
//             type: "object",
//             properties: {
//                 action: {
//                     type: "string",
//                     enum: ["return_data", "use_dom"],
//                     description: "The strategy chosen based on the size and complexity of the request."
//                 },
//                 extractedData: {
//                     type: "string",
//                     description: "Only populate this if action is 'return_data'. Provide the direct answer here."
//                 },
//                 domParams: {
//                     type: "object",
//                     description: "Only populate this if action is 'use_dom'.",
//                     properties: {
//                         selector: {
//                             type: "string",
//                             description: "The CSS selector to target the element."
//                         },
//                         extractType: {
//                             type: "string",
//                             enum: ["text", "html", "outerHtml"],
//                             description: "The method of extraction from the selected element."
//                         }
//                     },
//                     required: ["selector", "extractType"]
//                 }
//             },
//             required: ["action"],
//             additionalProperties: false
//         }
//     }
// };