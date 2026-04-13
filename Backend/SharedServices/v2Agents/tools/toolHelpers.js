import axios from 'axios';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { evaluate } from 'mathjs';
import { parseISO, differenceInMilliseconds, isValid} from 'date-fns';
import { FrontendMessageFormat, TextMessage, Roles } from '../core/classes.js';
// import { createTaskAgentJob } from "../../Engine/routes/taskAgent.js";

export const pathHelper = path;
export const fsHelper = fs;
export const readlineHelper = readline;
export const evaluateHelper = (input) => { evaluate(input) }
export const parseISOHelper = parseISO;
export const differenceInMillisecondsHelper = differenceInMilliseconds;
export const isValidHelper = isValid;
export const axiosHelper = axios;

// /** 
//  * Helper function which passes on task details to create a new Task Agent job. (Can be used by AI Tools)
//  * @param {string} taskDetails - the details of the task to be passed to the Task Agent
//  */
// export async function createNewTaskAgentJob(taskDetails){
//   let message = new TextMessage({
//     role: Roles.User,
//     textData: taskDetails
//   });
//   let frontendMessage = new FrontendMessageFormat({
//     messages : [message]
//   });
//   let job = await createTaskAgentJob(frontendMessage);
// }