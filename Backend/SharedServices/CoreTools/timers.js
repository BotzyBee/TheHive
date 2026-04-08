import * as su from '../Utils/index.js';
import dotenv from 'dotenv';
let allTimers = []; // Array of Timer Class

class timerClass {
  constructor(timerName, callbackFn, options = {}) {
    this.timerName = timerName;
    this.callbackFn = callbackFn;
    
    // Destructure options with defaults
    this.intervalMs = options.intervalMs || 0;
    this.delayMs = options.delayMs || 0;
    this.isOneOff = options.isOneOff || false;
    
    this.timerID = null; // Reference to the active timeout
    this.isRunning = false;
  }

  startTimer() {
    this.stopTimer(); // Safety clear
    this.isRunning = true;

    // Phase 1: The Initial Delay
    this.timerID = setTimeout(() => {
      this.execute();
    }, this.delayMs);
  }

  async execute() {
    if (!this.isRunning) return;

    try {
      // Execute the callback (supports both sync and async)
      await this.callbackFn();
    } catch (err) {
      console.error(`Timer ${this.timerName} failed:`, err);
    }

    // Phase 2: Decide whether to schedule the next run or cleanup
    if (!this.isOneOff && this.intervalMs > 0 && this.isRunning) {
      this.timerID = setTimeout(() => this.execute(), this.intervalMs);
    } else if (this.isOneOff) {
      this.isRunning = false;
      removeTimer(null, this.timerID); // Clean up one-off timers
    }
  }

  stopTimer() {
    this.isRunning = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  toJSON() {
    // Return only the properties that are "data"
    // Exclude timerID because it's a circular system object
    // Exclude callbackFn because functions can't be stringified
    return {
      timerName: this.timerName,
      intervalMs: this.intervalMs,
      delayMs: this.delayMs,
      isOneOff: this.isOneOff,
      isRunning: this.isRunning
    };
  }
}


/**
 * @param {string} timerName 
 * @param {function} callbackFn 
 * @param {object} options - { delay: number|Date, intervalMs: number, isOneOff: boolean }
 * @param {number|Date} options.delay - Initial delay before the first execution. Can be a number (ms) or a Date object.
 * @param {number} options.intervalMs - If provided and isOneOff is false, the timer will repeat at this interval.
 * @param {boolean} options.isOneOff - If true, the timer will execute only once.
 * @returns {Result[string]} - Ok(timerName) if created successfully, Err(message) if failed (e.g., duplicate name).
 */
export function addNewTimer(timerName, callbackFn, config = {}) {
  // Check for duplicates
  if (allTimers.some(t => t.timerName === timerName)) {
    return su.Err(`Error(addNewTimer) - ${timerName} already exists!`);
  }

  // Calculate delay if a Date object was provided
  let delay = config.delay || 0;
  if (delay instanceof Date) {
    delay = Math.max(0, delay.getTime() - Date.now());
  }

  const options = {
    delayMs: delay,
    intervalMs: config.intervalMs || 0,
    isOneOff: config.isOneOff || false
  };

  const tmr = new timerClass(timerName, callbackFn, options);
  tmr.startTimer();

  allTimers.push(tmr);
  return su.Ok(timerName);
}

export function removeTimer(optTimerName, optTimerID) {
  // catch no imput params
  if (optTimerID == null || optTimerName == null) {
    return su.Err(
      `Error (removeTimer) - you have to provide a timerName or TimerID as params`
    );
  }
  let allTimerLen = allTimers.length ?? 0;
  // catch empty allTimers array
  if (allTimerLen == 0) {
    return su.Ok('allTimers array is already empty');
  }
  // loop and remove matches
  for (let i = allTimerLen - 1; i >= 0; i--) {
    if (
      optTimerName === allTimers[i].timerName ||
      optTimerID === allTimers[i].timerID
    ) {
      allTimers[i].stopTimer();
      allTimers.splice(i, 1);
    }
  }
  return su.Ok(`All matching timers have been removed`);
}

export function getAllTimersAsString() {
  // JSON.stringify will automatically call .toJSON() on every timerClass instance in the array
  return su.Ok(JSON.stringify(allTimers));
}

export function stopAndClearAllTimers() {
  allTimers.forEach((timer) => {
    timer.stopTimer();
  });
  allTimers = [];
}

/**
 * Returns an object with the current day, date, epoch etc.
 * @param {object} params
 * @param {string} [params.dateFormat] - eg 'en-GB' the format for datetime object. Defaults to 'en-GB'. 
 * @returns {Result[object]} - { currentEpoch, fullDateTime, dayOfMonth, dayOfWeek,
 * monthName, monthNumber, year, timezone }
 */
export function getDateTime(params = {}) {
    const locale = params.dateFormat || 'en-GB';
    dotenv.config({ path: ".env" });
    const tz = process.env.TIMEZONE;
    const timeZone = tz;
    try {
        const now = new Date();
        // 1. Current Epoch
        const currentEpoch = now.getTime();
        // 2. Formatting Options for the Full String
        const fullDateTime = now.toLocaleString(locale, {
            timeZone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        // 3. Extract components using Intl.DateTimeFormat for reliability
        const parts = new Intl.DateTimeFormat(locale, {
            timeZone,
            day: 'numeric',
            weekday: 'long',
            month: 'long',
            year: 'numeric',
            timeZoneName: 'short'
        }).formatToParts(now);
        // Helper to find specific parts from the formatter
        const getPart = (type) => parts.find(p => p.type === type)?.value;
        const dayOfMonth = parseInt(getPart('day'));
        const dayOfWeek = getPart('weekday');
        const monthName = getPart('month');
        const monthNumber = now.getMonth() + 1; // Month is 0-indexed in JS
        const year = now.getFullYear();
        
        // This will correctly return "GMT" or "BST" based on the date
        const timezoneName = getPart('timeZoneName');

        let op = {
            currentEpoch,
            fullDateTime,
            dayOfMonth,
            dayOfWeek,
            monthName,
            monthNumber,
            year,
            timezone: timezoneName
        };
        return su.Ok(op);
    } catch (error) {
        return su.Err(`Error (getDateTimeContext) : ${error.message}`);
    }
}
