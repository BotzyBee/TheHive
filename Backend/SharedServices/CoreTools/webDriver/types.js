
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