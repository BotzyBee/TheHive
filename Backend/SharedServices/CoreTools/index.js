import { TimerManager } from "./timers.js";

export class CoreTools {
  constructor() {}
  /** @type {TimerManager} */
  timers = new TimerManager();
}
