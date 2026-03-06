import { log, formatBytes } from './misc.js';
import { Ok, Err } from './result.js';
import { generateLongID, generateShortID } from './refs.js';

// NOTE - None of the share utils functions can use SharedUtils (circular refs !!)
export class SharedUtils {
  constructor() {}
  /**
   * Generate Short ID (Action ID)
   * @param {string} prefix - optional prefix to the ID number
   * @returns {string} - example output Action-xxxx
   */
  shortID = generateShortID;
  /**
   * Generate Long ID
   * @param {string} prefix - optional prefix to the ID number
   * @returns {string} - example output ${prefix}-xxxx-xxxx-xxxx
   */
  longID = generateLongID;
  log = log;
  /**
   * Adds a log (input value) and returns the error object.
   * @param {any} value - accepts any type of data
   * @returns {object} { outcome: 'Error', value: the data passed as input }
   */
  logAndErr = (input) => {
    this.log(input);
    return this.result_err(input);
  };
  /**
   * Return Ok
   * @param {any} value - accepts any type of data
   * @returns {object} { outcome: 'Ok', value: the data passed as input }
   */
  result_ok = Ok;
  /**
   * Return Error
   * @param {any} value - accepts any type of data
   * @returns {object} { outcome: 'Error', value: the data passed as input }
   */
  result_err = Err;

  /**
   * Formats a given number of bytes into a human-readable string (e.g., KB, MB, GB).
   * @param {number} bytes - The size in bytes.
   * @param {number} decimals - The number of decimal places to include (default is 2).
   * @returns {string} The formatted file size.
   */
  formatBytes = formatBytes;
}
