import { Result } from './classes.js';

export let allLogs = []; // Holds all logs until written to file.

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
export function logAndErr(value) {
  log(value);
  return new Result(false, value);
}

// [][] -- Log Helper Fn -- [][]
const MAX_LOGS = 500;
export function log(...input) {
  console.log(...input);
  allLogs.push(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        message: input,
      },
      null,
      2
    )
  );
  if (allLogs.length > MAX_LOGS) {
    allLogs.shift();
  }
}
