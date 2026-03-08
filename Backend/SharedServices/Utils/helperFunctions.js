// See Helper functions below Ok, Err
import { log } from "./misc.js";
import { Result } from "../Classes/result.js";
import path from 'path';
import fs from 'fs';
import readline from 'readline';

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