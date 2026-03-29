/**
 * 🐝 TheHive Plugin Tool Standard - Deep Research Tool
 *  IMPORTANT: This tool requires aiWebSearch and superEditor Tool to function. Ensure both tools are present in the CoreTools/AgentCompatible directory.
 */

import { re } from 'mathjs';
import { AiCall } from '../../CallAI/index.js';
import { Services } from '../../index.js';
import { saveFile } from '../../FileSystem/index.js';
export const details = {
    toolName: "deepResearchTool",
    version: "0.0.4",
    creator: "System Architect",
    overview: "Conducts deep, factual, and actionable research on a given topic. It scopes the research, deconstructs terms, " 
    +"gathers official sources, fact-checks claims, and returns structured data. \n" 
    +"Limitations: Time-consuming for very broad topics; relies on available online sources. \n"
    +"Important: Only use this tool when the user explicitly requests in-depth research. For general questions, use the standard web search tool or other lighter tools.",
    guide: "Provide as much detail as possible in the 'topic' input. The tool will handle the rest, but clearer input can lead to better results.",
    inputSchema: JSON.stringify({
        type: "object",
        properties: {
            topic: {
                type: "string",
                description: "The main topic or question to research."
            },
            depth: {
                type: "number",
                description: "Research depth level (1-3), determining how many explorative loops to run. Defaults to 1."
            }
        },
        required: ["topic"],
        additionalProperties: false
    })
};

const INGORE_DOMAINS = []; // Example domains to ignore during source gathering
let stats = { aiCount: 0 }; // To track AI calls for cost management and analysis

class FactCheck {
    constructor({ claim } = {}){
        this.claim = claim || "";
        this.confidence = 0; // 0-1 scale of confidence in the claim based on evidence
        this.sources = []; 
        this.clarification = ""; 
    }

    getSummary(){
        return `Claim: ${this.claim}\nConfidence: ${this.confidence}\nClarification: ${this.clarification}`;
    }
}

export class ResearchChunk {
    constructor({ Shared, question } = {}){
        this.Shared = Shared;
        this.question = question || "";
        this.firstResponse = "";
        this.references = []; // {ref, url}
        this.factsOrAssumptions = []; // Array of FactCheck objects to evaluate the claims made in the response
        this.futherExploration = [];
        this.output = "";
    }
  
    async getInitialResearch(domains = []){
        // Use the aiWebSearch tool to get an initial response to the question, along with sources.
        let call = await this.Shared.CoreTools.AgentCompatible.aiWebSearch.run(
            this.Shared, 
            { taskDescription: this.question, domains: domains }
        );
        if (call.isErr()){ return this.Shared.Utils.Err(`Error in ResearchChunk -> getInitialResearch : ${call.value}`)}
        stats.aiCount += 1; 
        // Returns DataMessage with data: { result: string , sources: [ref, url] }
        this.firstResponse = call.value[0].data.result;
        this.references = call.value[0].data.sources;
        return this.Shared.Utils.Ok();
    }

    async factCheckClaims(domains = []){
        console.log("Starting fact-checking of claims.");
        // Create a list of claims or 'claimed facts' from the firstResponse to be fact-checked. This is a critical step to ensure we are building on accurate information.
        let aiCall = new this.Shared.AiCall.AiCall();
        let call = await aiCall.generateText(
            PromptsAndSchemas.factCheck.sys,
            PromptsAndSchemas.factCheck.usr(this.firstResponse),
            { structuredOutput: PromptsAndSchemas.factCheck.schema }
        ); // Returns { claims: [ 'claim1', 'claim2', ... ] }
        if (call.isErr()){ return this.Shared.Utils.Err(`Error in ResearchChunk -> factCheckClaims : ${call.value}`)};
        stats.aiCount += 1;
        let claims = call.value.claims;
        // for each claim we add it to a FactCheck object for progression. 
        this.factsOrAssumptions = claims.map(c => new FactCheck({ claim: c }));
        console.log("Claims identified for fact-checking: ", this.factsOrAssumptions.length);

        // loop over claims. 
        for (let fact of this.factsOrAssumptions){
            let prompt = `Fact-check the following claim: "${fact.claim}". Identify if it's a fact or an assumption. Find sources to back up or refute the claim. Aim for factual accuracy and provide detail on why the claim is verified or refuted.`;
            let searchCall = await this.Shared.CoreTools.AgentCompatible.aiWebSearch.run(
                this.Shared,
                { taskDescription: prompt, domains: domains }
            ); // Returns DataMessage with data: { result: string , sources: [ref, url] }
            if (searchCall.isErr()){ return this.Shared.Utils.Err(`Error in ResearchChunk -> factCheckClaims -> aiWebSearch : ${searchCall.value}`)};
            stats.aiCount += 1;
            // Evaluate the claim based on the evidence found. Return a confidence score and clarification. 
            let evidence = searchCall.value[0].data.result;
            fact.sources = searchCall.value[0].data.sources;
            let scoring = await aiCall.generateText(
                PromptsAndSchemas.factCheck2.sys,
                PromptsAndSchemas.factCheck2.usr(fact.claim, evidence),
                { structuredOutput: PromptsAndSchemas.factCheck2.schema }
            ); // Returns { confidenceScore: 0-1, clarification: string }
            if (scoring.isErr()){ return this.Shared.Utils.Err(`Error in ResearchChunk -> factCheckClaims -> generateText : ${scoring.value}`)};
            stats.aiCount += 1;
            fact.confidence = scoring.value.confidenceScore;
            fact.clarification = scoring.value.clarification;
        }
        return this.Shared.Utils.Ok();
    }

    async finaliseResearchChunk(){
        let aiCall = new this.Shared.AiCall.AiCall();
        let clarifications = this.factsOrAssumptions.map(f => f.getSummary()).join("\n\n");
        // use the initial result and all fact checking results to generate a final output.
        let prompt = `
Using the initial research response: "${this.firstResponse}" and the following fact-checking details for each claim: ${clarifications}, produce a final researched output. 
Focus on factual accuracy, actionable information, and clarity. Keep all references intact and ensure the final output is concise and informative.`;
        let finalCall = await aiCall.generateText(
            `Your task is to finalise a research output based on an initial response and detailed fact-checking of its claims. Focus on factual accuracy, actionable information, and clarity. Do not add any of your own thoughts - solely use the initial response and the fact-checking details to produce the final output.
            Use UK English when responding. This is only one chunk of a broader reseach process. You do not need to introductions or conclusions. Focus on the information itself.`,
            prompt);
        if (finalCall.isErr()){ return this.Shared.Utils.Err(`Error in ResearchChunk -> finaliseResearchChunk -> generateText : ${finalCall.value}`)};
        stats.aiCount += 1;
        this.output = finalCall.value; 
        return this.Shared.Utils.Ok();
    }
}

export async function scopeTopic(Shared, topic, breadth = 5){
    const callAI = new Shared.AiCall.AiCall();
    console.log("Scoping Research Task.")
    // Resolve any terms or acronyms in the topic.
    let termscall = await callAI.webSearch(
        PromptsAndSchemas.initTerms.sys,
        PromptsAndSchemas.initTerms.usr(topic),
        {  structuredOutput: PromptsAndSchemas.initTerms.schema}
    ); // learnings: [ { term: '', definition: ''} ]
    if (termscall.isErr()){ return Shared.Utils.Err(`Error in scopeTopic -> initTerms : ${termscall.value}`)}
    // Merge learnings into a single string to pass to the next prompt
    let defs = termscall.value.learnings.map(l => `${l.term} : ${l.definition}`).join("\n \n");
    
    // Generate a list of the most relevant explorative questions to guide the research.
   let questionCall = await callAI.generateText(
        PromptsAndSchemas.explore.sys,
        PromptsAndSchemas.explore.usr(topic, defs),
        { structuredOutput: PromptsAndSchemas.explore.schema }
    ); // questions: [ 'question1', 'question2', ... ]
    if (questionCall.isErr()){ return Shared.Utils.Err(`Error in scopeTopic -> explore : ${questionCall.value}`)}

    // Rank the questions to prioritise the most relevant and explorative ones.
    let rankedCall = await callAI.generateText(
        PromptsAndSchemas.rankQuestions.sys,
        PromptsAndSchemas.rankQuestions.usr(topic, questionCall.value.questions),
        { structuredOutput: PromptsAndSchemas.rankQuestions.schema }
    ); // ratings: [ 0-100, 0-100, ... ]
    if (rankedCall.isErr()){ return Shared.Utils.Err(`Error in scopeTopic -> rankQuestions : ${rankedCall.value}`)}

    // Combine questions and ratings to select the top questions for research.
    let combined = questionCall.value.questions.map((q, i) => ({ question: q, rating: rankedCall.value.ratings[i] }));
    combined.sort((a, b) => b.rating - a.rating); // Sort by rating descending
    let topQuestions = combined.slice(0, breadth).map(q => q.question); // Take top questions based on breadth

    // Research Sources
    let sourcesCall = await callAI.webSearch(
        PromptsAndSchemas.getSources.sys,
        PromptsAndSchemas.getSources.usr(topic, topQuestions, JSON.stringify(INGORE_DOMAINS)),
        { structuredOutput: PromptsAndSchemas.getSources.schema }
    ); // domains: [ 'domain1.com', 'domain2.com', ... ]
    if (sourcesCall.isErr()){ return Shared.Utils.Err(`Error in scopeTopic -> getSources : ${sourcesCall.value}`)}

    // 2nd Run at sources (get widest range of sources)
    let sourcesCall2 = await callAI.webSearch(
        PromptsAndSchemas.getSources.sys,
        PromptsAndSchemas.getSources.usr(topic, topQuestions, sourcesCall.value.domains.join(", ")),
        { structuredOutput: PromptsAndSchemas.getSources.schema }
    ); // domains: [ 'domain1.com', 'domain2.com', ... ]
    if (sourcesCall2.isErr()){ return Shared.Utils.Err(`Error in scopeTopic -> getSources : ${sourcesCall2.value}`)}

    stats.aiCount += 5; // Increment AI call count for this function
    return Shared.Utils.Ok({ terms: defs, questions: topQuestions, sources: sourcesCall2.value.domains });
}

let RESEARCH_CHUNKS = []; // Global array to hold all research chunks for the entire research process. Each chunk represents a question, its response, and related data.

/**
 * Core run function adhering to TheHive Plugin Tool Standard.
 *
 * @param {object} Shared - Core Hive services.
 * @param {object} params - Inputs defined in inputSchema.
 * @param {string} params.topic - The main topic or question to research.
 * @param {number} params.depth - Research depth level (1-3), determining how many explorative loops to run. Defaults to 1.
 * @param {number} params.breadth - Number of top questions to consider for research. Defaults to 5.
 * @returns {Promise<object>} Shared.Utils.Ok or Shared.Utils.Err.
 */
export async function run(Shared = Services, params = {}) {
    const { topic, depth = 1, breadth = 3 } = params;
    
    if (!topic || typeof topic !== 'string') {
        return Shared.Utils.Err("Error (deepResearchTool) requires a valid 'topic' string.");
    }

    // [][] ----- RESEARCH PHASE ------ [][]
    // Scope the topic, find best questions and sources to research.
    let scoping = await scopeTopic(Shared, topic, breadth); 
    if (scoping.isErr()){ return Shared.Utils.Err(`Error (deepResearchTool) in run -> scopeTopic : ${scoping.value}`)}
    let firstChunk = new ResearchChunk();
    firstChunk.output = scoping.value.terms;
    RESEARCH_CHUNKS.push(firstChunk); // Store scoped terms as the first research chunk.

    //Loop through the top questions and conduct research, iteratively building context and learnings.
    let questionLength = scoping.value.questions.length ?? 0;
    for (let i = 0; i < questionLength; i++) {
        let question = scoping.value.questions[i];
        let chunk = new ResearchChunk({ Shared: Shared, question: question });
        await chunk.getInitialResearch();
        console.log("Initial Research Output done");
        await chunk.factCheckClaims();
        await chunk.finaliseResearchChunk();
        RESEARCH_CHUNKS.push(chunk); // Store each research chunk for potential later review or report generation.
        console.log(`Completed research for question ${i + 1}/${questionLength}`);
    }

    // [][] ----- WRITING PHASE - CREATE REPORT PLAN ------ [][]
    // Create a final report plan (layout, sections, structure) based on the research chunks and user task.
    let callAI = new Shared.AiCall.AiCall();
    let chunkLength = RESEARCH_CHUNKS.length ?? 0;
    // reverse order as first chunk is just definitions and terms.
    let latestPlan = ""; 
    for (let i = chunkLength - 1; i >= 0; i--){
        console.log(`Generating report plan for chunk ${i + 1}/${chunkLength}`);
        let planCall = await callAI.generateText(
            PromptsAndSchemas.reportPlan.sys,
            PromptsAndSchemas.reportPlan.usr(topic, RESEARCH_CHUNKS[i].output, latestPlan),
        );
        if (planCall.isErr()){ return Shared.Utils.Err(`Error in run -> reportPlan : ${planCall.value}`)}
        stats.aiCount += 1;
        latestPlan = planCall.value; // Update the latest plan with the current plan call result
    }
    // turn plan into array of actions
    let planArray = [];
    let planArrayCall = await callAI.generateText(
        PromptsAndSchemas.planArray.sys,
        PromptsAndSchemas.planArray.usr(latestPlan),
        { structuredOutput: PromptsAndSchemas.planArray.schema }
    );
    if (planArrayCall.isErr()){ return Shared.Utils.Err(`Error in run -> planArray : ${planArrayCall.value}`)}
    planArray = planArrayCall.value.sections;
     
    // [][] ----- WRITING PHASE - CREATE EACH SECTION ------ [][]

    let latestReport = `# ${planArrayCall.value.reportTitle ? planArrayCall.value.reportTitle : ""}`; // Start with the title.
    let planLen = planArray.length ?? 0;
    // combine research chunks
    let combinedResearch = RESEARCH_CHUNKS.map(c => c.output).join("\n\n");
    for(let i=0; i<planLen; i++){
         console.log(`Writing report section for section ${i + 1}/${planLen}`);
        let sectionCall = await callAI.generateText(
            PromptsAndSchemas.writeSection.sys,
            PromptsAndSchemas.writeSection.usr(planArray[i], combinedResearch, latestReport)
        ); // Returns the text for this section of the report.
        if (sectionCall.isErr()){ return Shared.Utils.Err(`Error in run -> writeSection : ${sectionCall.value}`)}
        stats.aiCount += 1;
        latestReport += `\n\n${sectionCall.value}`; // Append each section to build the full report.
    }
    await Shared.FileSystem.saveFile("./", latestReport, `First_Draft${Date.now()}.txt`);
    
    // Final Review and Polishing (1)
    for(let i=0; i<2; i++){ // Run 2 loops of review and polish to ensure quality and coherence.
        console.log(`Final review loop ${i + 1}/2`);
        let sectionCall = await callAI.generateText(
            PromptsAndSchemas.finalCheck.sys,
            PromptsAndSchemas.finalCheck.usr(latestReport)
        ); // Returns a prompt for final edits and polishing.
        if (sectionCall.isErr()){ return Shared.Utils.Err(`Error in run -> finalCheck : ${sectionCall.value}`)}
        stats.aiCount += 1;
        let polishPrompt = sectionCall.value;

        if (polishPrompt === "NO-EDITS-NEEDED") break;

        console.log("Final Review Feedback: ", polishPrompt);
        console.log(`Performing final edit and polish of the report.`);

        // Final Review and Polishing (2)
        let editAgent = await Shared.CoreTools.AgentCompatible.superEditor.run(
            Shared,
            { prompt: PromptsAndSchemas.editAgentPrompt.prompt(polishPrompt), document: latestReport, context: "" }
        ); // Returns DataMessage with data : { success, editedDocument , textualDiff , chunksProcessed , timestamp }
        if (editAgent.isErr()){ return Shared.Utils.Err(`Error in run -> superEditor : ${editAgent.value}`)}
        latestReport = editAgent.value[0].data.editedDocument; // Update the latest report with the edited document from the superEditor tool.
        // TODO handle ai count from superEditor tool .   
        await Shared.FileSystem.saveFile("./", latestReport, `Final_Report_${Date.now()}.txt`);
        }
        
    return Shared.Utils.Ok({ report: latestReport, stats: stats });
}


const PromptsAndSchemas = {
    initTerms: {
        sys: `Your task is to review a user provided research topic and identify any niche terms or acronyms which a regular person may not understand.
        Any niche terms or acronyms found should then be researched to provide the user clarity. 
        If no niche terms or acronyms are found you must return an empty array []`,
        usr: (prompt) => { return `Here is the research prompt given by the user <prompt>${prompt}</prompt>`},
        schema: {
            "type": "object",
            "description": "An object containing a 'learnings' property, where 'learnings' is an array of objects.",
            "properties": {
                "learnings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "term": {"type": "string"},
                            "definition": {"type": "string"}
                        },
                        "required": [ "term", "definition"]
                    }
                }
            },
            "required": ["learnings"]
        }
    },
    explore: {
        sys: `Your task is to help the user explore a research topic by suggesting research questions. 
        You should consider questions which seek to explore the user provided topic in a balanced way, testing assumptions and considering inverse or counter arguments. 
        The aim is to provide a starting point for rigorous academic research.
        The questions should seek to surface evidence for and against a particular point.
        Questions should also consider external factors or influences on a topic where relevant.
        Return as many questions as possible however keep each question unique and avoid duplication or overlapping research. If you cannot think of any questions then return an empty array []`,
        usr: (prompt, defs) => { return `What questions should I ask to get a better understanding of the following topic? <topic>${prompt}</topic>. Here are some definitions (if any) which might help <definitions> ${defs} </definitions>`},
        schema: {
            "type": "object",
            "description": "An object containing a 'learnings' property, where 'learnings' is an array of strings (questions)",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "An array of questions to help the user research a topic.",
                }
            },
            "required": ["questions"]
        }
    },
    rankQuestions: {
        sys: `Your task is to review the provided list of questions and determine which ones are most relevant to the research task. 
        You should favour questions that are on topic and seek to explore the topic in a balanced way, testing assumptions and considering inverse or counter arguments.
        You should also favour questions that seek evidence and consider external factors or influences on a topic where relevant. 
        You will output score for each question between 0 and 100 – where 100 is very relevant, explorative and well structured and 0 is not relevant, shallow and poorly structured. `,
        usr: (prompt, questions) => { return `Research topic <topic>${prompt}</topic>. Questions - <questions> ${questions} </questions>`},
        schema: {
            "type": "object",
            "description": "An object containing a 'ratings' property, where 'ratings' is an array of numbers",
            "properties": {
                "ratings": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "An array of ratings for each question",
                }
            },
            "required": ["ratings"]
        }
    },
    getSources: {
        sys: `Your task is to find the most reliable website sources for the user's research topic. You should focus on official sources, academic sources and reputable websites/ knowledgebases.  
        Add as many sources as possible as long as they meet the required standard.
        OUTPUT FORMAT : ['domain1.com', 'domain2.com']`,
        usr: (prompt, questions, ignore) => { return `Find the most reliable sources to complete the following research: <topic>${prompt}</topic> <questions> ${questions} </questions>. Do not output or use the following domains <ignore> ${ignore} </ignore>`},
        schema: {
            "type": "object",
            "description": "An object containing a 'domains' property, where 'domains' is an array of strings",
            "properties": {
                "domains": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "An array of website domains",
                }
            },
            "required": ["domains"]
        }
    },
    askQuestion: {
        sys: `Your task is to search high quality and reliabile sources to answer the users question. 
        You should focus on giving academic and where possible data-rich answers focusing on ground truth. You should avoid personal judgements and needless adjectives.`,
        usr: (question) => { return `Here is the research question - <questions> ${question} </questions>.`}
    },
    writeSection: {
        sys: `You must focus on writing well structured and logical text using only the information you have been provided. You must never add your own thoughts or comments. You should keep your writing style academic and factual. 
You should make no statement that isn't backed up by fact. Adjectives and personal opinions must be avoided unless used in a direct quote "".
It is important that you use UK English, markdown formatting, and retain the quote references eg [ref33f38]. 
You must never reference this task in your writing and do not need to provide commentary such as ‘ok here is your report…’. Never combine more than one ref in square brackets.
You will only be writing one section of a broader report. You do not need to introductions or conclusions. Focus on the information itself. Do not add any information which is not in the provided research.
Use the current version of the report to ensure the section you are writing fits in well with the other sections and does not repeat information. You are aiming for concise and information-dense writing.
Avoid repetition as a priority.`,
    usr: (plan, research, report) => { return `Here is the plan for the section you need to write <plan> ${plan} </plan>. Here is the research you can use to write this section <research> ${research} </research>. Here is the current version of the report <report> ${report} </report>.`}
    },
       
    factCheck: {
        sys: `Your task is to fact-check the provided text. You should identify any claims or assumptions made which are very material and would be important to verify for a reader.
If a fact or assumption is minor, general in nature or not material to the overall understanding of the topic then it does not need to be included. You should aim to output a maximum of 10 claims or assumptions to verify. 
You must focus on the most important claims or assumptions to fact-check and avoid including minor or trivial claims. Figures, dates, proper nouns, and specific factual statements should be prioritised for fact-checking.
General statements or opinions should not be included unless they contain a specific claim that can be verified. `,
        usr: (text) => { return `Fact-check the following text and return an array of claims or assumptions that should be verified. <text> ${text} </text>`},
        schema: {
            "type": "object",
            "description": "An object containing a 'claims' property, where 'claims' is an array of strings.",
            "properties": {
                "claims": {
                    "type": "array",
                    "items": {
                        "type": "string",
                    },
                    "description": "An array of claims or assumptions which should be verified."
                }
            },
            "required": ["claims"]
        }
    },
    factCheck2: {
        sys: `Your task is to review the provided text to identify the claim being reviewed is an accepted assumption or fact, or whether it has been disputed or refuted. 
    You should output a confidence score between 0 and 1 for the claim based on the strength of evidence found. 0 being the claim is likely false or refuted, 1 being the claim is likely true or accepted.
    Give clarification on the claim to help give the agent an understanding of why the claim is supported or refuted and how the fact should be presented in the final research output.`,
        usr: (claim, research) => { return `Here is the claim to fact-check <claim> ${claim} </claim>. Here is the research gathered on the claim <research> ${research} </research>. `},
        schema: {
        "type": "object",
        "properties": {
            "confidenceScore": {
            "description": "A score representing certainty, ranging from 0 to 1.",
            "type": "number",
            "minimum": 0,
            "maximum": 1
            },
            "clarification": {
            "description": "Clarification on the claim to help give the agent an understanding of why the claim is supported or refuted and how the fact should be presented in the final output.",
            "type": "string"
            }
        },
        "required": ["confidenceScore", "clarification"],
        "additionalProperties": false
        }
    },
    reportPlan: {
        sys: `Your task is to create a structured plan for a research report based on the user's research topic and the research chunks completed.
The report plan should include a suggested layout, sections, and structure for the final report. 
The plan should focus on how to best present the research findings in a clear, logical, and engaging way for the reader. 
Consider how to group related research chunks together into sections, and what order to present them in for maximum impact and clarity. 
The plan should also consider the user’s original task and ensure that the report structure is designed to effectively address the user's needs and questions. 
You should not write any of the actual report content at this stage - just the plan and structure for how the report should be written.
This will be an interative process - you will be given each section of research and you should update the plan for each one. You will be given the latest version of the report plan each time you update it. 
Focus on how to best structure and present the information for the reader, and do not add your own thoughts or opinions. Use only the research and user task as a guide for how to structure the report.`,
        usr: (userTask, researchChunks, latestPlan) => { 
            return `Here is the user task <task> ${userTask} </task>. 
Here are the research chunks completed so far <research> ${JSON.stringify(researchChunks)} </research>. 
Here is the latest version of the report plan <latestPlan> ${JSON.stringify(latestPlan)} </latestPlan>. 
Based on this information, create a structured plan for a research report including suggested layout, sections, and structure.`},
    },
    planArray: {
        sys: `Role: You are a Research Architect. Your task is to decompose a raw research plan into an array of discrete, logical sections that will serve as the blueprint for an in-depth report.

Core Objectives:
- Distinct Logic: Each section must have a unique focus. If two points in the plan are related, synthesize them into a single comprehensive section to eliminate redundancy.
- Exclusionary Scope: Do not invent new data or external content. Use only the provided report plan.
- Structural Integrity: Sections must follow a logical narrative flow (e.g., Context $\rightarrow$ Methodology $\rightarrow$ Analysis $\rightarrow$ Synthesis).
- Formatting: Return an array of strings. Use standard numbering (1., 2., 3.) for headings.

Constraint Checklist:
  - Output the title in the reportTitle field. Do not include a title in the sections array.
  - No References: Omit any bibliography or reference sections.
  - Concise Synthesis: Combine overlapping themes from the plan into singular, high-impact sections.
  - Content Guidance: Within each section, provide 3–5 bullet points detailing the specific sub-topics or arguments to be covered based on the plan.

Example Output:
["1. Executive Summary\n* Synthesize the core research question and the primary thesis.\n* Outline the key data points or case studies identified in the plan.\n* Summarize the final high-level conclusions and strategic recommendations.",
"2. Comparative Framework and Methodology\n* Define the scope of the research and the specific variables being analyzed.\n* Detail the criteria used for categorizing the subjects (e.g., by GDP, industry, or region).\n* Explain the qualitative or quantitative approach dictated by the research plan.",
"3. Current Landscape and Market Drivers\n* Analyze the existing state of the field based on the provided plan.\n* Identify the primary technological or economic drivers triggering the research.\n* Address the specific environmental or regulatory factors mentioned in the input.",
"4. Analysis of Disparate Impacts\n* Contrast the specific findings between the primary research groups.\n* Highlight the unique challenges and opportunities identified for each segment.\n* Isolate the root causes of the observed variances.",
"5. Synthesis and Future Projections\n* Connect the individual findings into a cohesive global outlook.\n* Outline the long-term implications for stakeholders.\n* Propose specific action items or policy adjustments based on the analyzed data."
, ... etc ]`,
    usr: (latestPlan)=>{ return `Here is the latest version of the plan <plan>${latestPlan}</plan>. Output an array which includes the headings and sub-headings. Include as much detail as possible in each array item.`},
        schema: {
        "type": "object",
        "properties": {
            reportTitle: {
                "type": "string",
                "description": "The title of the research report."
            },
            "sections": {
            "type": "array",
            "description": "A list of section titles or identifiers.",
            "items": {
                "type": "string"
                }
            }
        },
        "required": ["reportTitle", "sections"]
    }
    },
    finalCheck: {
        sys: `Role: Your task is to perform a final, quality check on the provided report to ensure it is publication-ready, free of major duplication and well formatted.

Core Objectives:
- Linguistic Precision: Ensure the entire report adheres strictly to UK English (e.g., optimise, labour, centre).
- Structural Integrity: Verify that the numbering is sequential and the layout is consistent throughout. Headings should follow a logical hierarchy (e.g., 1, 1.1, 1.2, 2, etc.) and formatting should be uniform (e.g., all headings in bold).
- Redundancy Detection: Identify and flag instances of "clumsy" duplication, such as paragraphs repeated from copy-pasting, overlapping arguments, or identical sentences appearing in different sections.
- Technical Polish: Ensure all punctuation is professional and consistent (e.g., Oxford commas if used throughout, consistent bullet point styles).
  
Output Format: You should craft consise and direct 'prompt' for a edit agent to follow. This should be short, clear and actionable. Do not include 'fluff' or general statements.  

IMPORTANT: If no edits are needed output 'NO-EDITS-NEEDED'.`,
        usr: (report) => { return `Here is the final draft of the report <report>${report}</report>.`}
    },
    editAgentPrompt: {
        prompt: (reviewFeedback) => { 
return `Your task is to edit the research report based on the provided feedback. Here is the feedback from the review stage : ${reviewFeedback}`;}
    }   
}