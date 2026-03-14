import * as su from '../Utils/index.js';
import dotenv from 'dotenv';
let allTimers = []; // Array of Timer Class

class timerClass {
  constructor(timerName, callbackFn, intervalMs) {
    this.timerID = null;
    this.timerName = timerName;
    this.callbackFn = callbackFn; // either function name or anon function () => { testFN(param1, param2) }
    this.intervalMs = intervalMs;
  }
  startTimer(optIntervalMs) {
    // clear any already running timers
    if (this.timerID !== null) {
      clearInterval(this.timerID);
    }
    if (optIntervalMs) {
      // use new interval
      this.timerID = setInterval(this.callbackFn, optIntervalMs);
    } else {
      // use interval from class init
      this.timerID = setInterval(this.callbackFn, this.intervalMs);
    }
  }
  stopTimer() {
    clearInterval(this.timerID);
  }
}


export function addNewTimer(timerName, callbackFn, intervalMs) {
  // check for duplicates
  allTimers.forEach((timer) => {
    if (timer.timerName === timerName) {
      return su.Err(
        `Error(addNewTimer) - ${timerName} already exists!`
      );
    }
  });
  // create new class
  let tmr = new timerClass(timerName, callbackFn, intervalMs);
  tmr.startTimer();

  // push to allTimers
  allTimers.push(tmr);
  su.log(`Interval timer : ${tmr.timerName} added. ID: ${tmr.timerID}`);
  return su.Ok(tmr.timerID);
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
