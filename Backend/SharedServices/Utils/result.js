// ALL FUNCTIONS MUST USE RESULT CLASS!
// See Helper functions below Ok, Err
import { log } from "./misc.js";

class Result {
  #ResultText = {
    Error: 'Error',
    Ok: 'Ok',
  };
  constructor(ok, value) {
    if (ok === true) {
      this.outcome = this.#ResultText.Ok;
      this.value = value;
    }

    if (ok === false) {
      this.outcome = this.#ResultText.Error;
      this.value = value;
    }
  }

  isOk() {
    if (this.outcome === this.#ResultText.Ok) {
      return true;
    } else {
      return false;
    }
  }

  isErr() {
    if (this.outcome === this.#ResultText.Error) {
      return true;
    } else {
      return false;
    }
  }

  stringify() {
    return JSON.stringify({ outcome: this.outcome, value: this.value });
  }
}

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
