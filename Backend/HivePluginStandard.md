## TheHive - Plugin Tool Standard
ALL Agent Compatable tools MUST adhere to the following to ensure compatability

1. Tools must expose the following methods

```
export details = {
    toolName:   "theNameOfYourTool", // must be unique!
    version:    "",
    creator:    "",
    overview:   "A clear overview of what the tool does and doesn't do" 
    +"This is used by AI agents to determin if your tool should be used to complete a task." 
    +"It should be clear and consise.", 
    guide:      null | "Optional - more detailed instructions for the agent to follow.",
    schema: {} // JSON schema detailing the input parameters for the tool  
}

export async function run( 
    Shared, 
    params = {}
){ }
```

When called, Shared Services will be injected into Shared allowing you to utilise the core classes and functions. Any params expected should match the schema. 

2. All tools must return a Result Type. Any return data MUST be array containing one or more Message Types [TextMessage | ImageMessage | AudioMessage | DataMessage] - as defined in SharedServices/Classes/aiMessages.js or a string in the case of an error. Any message coming from a tool MUST have role = Roles.Tool (Roles object is also defined in aiMessages.js)

Result type can be found in SharedServices/Classes/result.js . A helper functions have been created in Utils/helperFunctions.js - these allow quick use of Result type. For example return Shared.Utils.Ok(YourData) or return Shared.Utils.Err(YourError); 
