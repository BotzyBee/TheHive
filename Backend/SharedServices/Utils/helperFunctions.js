// See Helper functions below Ok, Err
import { log } from "./misc.js";
import { Result } from "../Classes/result.js";
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { evaluate } from 'mathjs';
import { JOBS } from "../../Engine/jobManager.js";
import { createTaskAgentJob } from "../../Engine/routes/taskAgent.js";
import { FrontendMessageFormat, TextMessage, Roles } from "../Classes/aiMessages.js";
import { parseISO, differenceInMilliseconds, isValid} from 'date-fns';
import axios from 'axios';

/**
 * Return Ok
 * @param {any} value - accepts any type of data
 * @returns {Result} { outcome: 'Ok', value: the data passed as input }
 */
export function Ok(value) {
  return new Result(true, value);
}

/**
 * Return Error
 * @param {any} value - accepts any type of data
 * @returns {Result} { outcome: 'Error', value: the data passed as input }
 */
export function Err(value) {
  return new Result(false, value);
}

/**
 * Adds value to a log and returns the error object.
 * @param {any} value - accepts any type of data
 * @returns {Result} { outcome: 'Error', value: the data passed as input }
 */
export function logAndErr(value){
    log(value);
    return new Result(false, value);
};

export const pathHelper = path;
export const fsHelper = fs;
export const readlineHelper = readline;
export const evaluateHelper = (input) => { evaluate(input) }
export const parseISOHelper = parseISO;
export const differenceInMillisecondsHelper = differenceInMilliseconds;
export const isValidHelper = isValid;
export const axiosHelper = axios;

/**
 * 
 * @param {strting} jobID- the ID of the job to update 
 * @param {string} statusText - the custom status text to set for the job. 
 */
export function updateCustomTaskStatus(jobID, statusText){
  let job = JOBS.jobListManager({getJob: jobID});
  if(job) {
    job.status.setCustomStatus(statusText);
  }
}


/** 
 * Helper function which passes on task details to create a new Task Agent job. (Can be used by AI Tools)
 * @param {string} taskDetails - the details of the task to be passed to the Task Agent
 */
export async function createNewTaskAgentJob(taskDetails){
  let message = new TextMessage({
    role: Roles.User,
    textData: taskDetails
  });
  let frontendMessage = new FrontendMessageFormat({
    messages : [message]
  });
  let job = await createTaskAgentJob(frontendMessage);
}