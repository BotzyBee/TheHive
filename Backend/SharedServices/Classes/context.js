import { getDateTime } from "../CoreTools/timers.js";

export class ContextTemplate {
    constructor() {
        this.globalData = {
            timeAndDate: ""
        };
        this.toolData = {}; 
        this.updateDateTime();
    }

    /**
     * Updates globalData.timeAndDate with current time/ date.
     */
    updateDateTime(){
        let getDT = getDateTime();
        if(getDT.isOk()){
            let d = getDT.value;
            this.globalData.timeAndDate = `Today is ${d.dayOfWeek} ${d.dayOfMonth} ${d.monthName} ${d.year} (Epoch: ${d.currentEpoch}, Date: ${d.fullDateTime}). The user is in timezone: ${d.timezone}`;
        }
    }

    /**
     * Adds a key and value to the Global Data Context
     * @param {string} key  
     * @param {any} value 
     */
    addCustomGlobalContext(key, value){
        this.globalData[key] = value;
    }

    /**
     * Returns the full context (global / tool) as JSON string
     * @returns {string} - JSON String
     */
    getFullContextString(){
        return JSON.stringify(this, null, 2);
    }

    /**
     * Returns the Global Context as JSON string
     * @returns {string} - JSON String
     */
    getGlobalContextString(){
        return JSON.stringify(this.globalData, null, 2);
    }
    
    /**
     * Returns all Tool Data (summary) as JSON string
     * @returns {string} - JSON String
     */
    getToolContextString(){
        return JSON.stringify(this.toolData, null, 2);
    }

    /**
     * Returns the tool data object. Note tool data may have been shortened. 
     * @returns {object} 
     */
    getAllToolsContext(){
        return this.toolData;
    }

    /**
     * Returns a single tool data object. Note tool data may have been shortened. 
     * @returns {object | null} - 
     */
    getSingleToolContext(toolID){
        if(typeof toolID === "string" && toolID != ""){
            let toolData = this.toolData[toolID] ?? null;
            return toolData;
        }
    }

    getAllContext(){
        return this;
    }

    /**
     * Import a Context Template object - useful for passing between threads
     * @param {object} data - Context object 
     * @returns - returns this
     */
    import(data) {
    if (!data || typeof data !== 'object') return;
    // Iterate through the keys of the incoming object
    Object.keys(data).forEach(key => {
        // Only map if the property already exists in 'this'
        if (Object.prototype.hasOwnProperty.call(this, key)) {
            this[key] = data[key];
        }
    });
    return this;
    }
}