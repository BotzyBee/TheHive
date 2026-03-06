// ALL FUNCTIONS MUST USE RESULT CLASS!
// See Helper functions below Ok, Err

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

// Result helper functions
export function Ok(value) {
  return new Result(true, value);
}
export function Err(value) {
  return new Result(false, value);
}
