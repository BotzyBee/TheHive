
export class RustAgentMessage {
    constructor(job_id, base_url, message_type, data) {
        this.job_id = job_id || "";
        this.base_url = base_url || "";
        this.message_type = message_type || "";
        this.outcome = RustMessageOutcome.NotSet;
        this.data = data || {};
    }
}

export const RustMessageType = {
  Update: "Update",
  Data: "Data", 
  DomResponse: "DomResponse",
  Error: "Error",
  Request: "Request"  
}

export const RustMessageOutcome = {
    Success: "Success",
    Error: "Error",
    NotSet: "NotSet"   
}

export class RustWebAction {
    constructor(action_type, selector, text, delay_ms, x, y) {
        this.action_type = action_type || "";
        this.selector = selector || null;
        this.text = text || null;
        this.delay_ms = delay_ms || null;
        this.x = x || null;
        this.y = y || null;
    }
}