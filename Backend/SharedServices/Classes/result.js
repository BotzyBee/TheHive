// Return class for all agent compatable tools
export class ToolOutput {
    constructor(toolName, toolTask, data){
        this.tool = toolName,
        this.action = toolTask,
        this.data = data
    }
}

export class Result {
  #ResultText = {
    Error: 'Error',
    Ok: 'Ok'
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