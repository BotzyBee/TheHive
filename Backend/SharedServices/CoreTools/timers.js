import * as su from '../Utils/index.js';

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
      return su.logAndErr(
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
    return su.logAndErr(
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

