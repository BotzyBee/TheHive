import { getDateTime } from "../CoreTools/timers.js";

export class ContextTemplate {
    constructor() {
        this.globalData = {
            timeAndDate: ""
        };
        this.toolData = {}; 
        this.updateDateTime();
    }
    updateDateTime(){
        let getDT = getDateTime();
        if(getDT.isOk()){
            let d = getDT.value;
            this.globalData.timeAndDate = `Today is ${d.dayOfWeek} ${d.dayOfMonth} ${d.monthName} ${d.year} (Epoch: ${d.currentEpoch}, Date: ${d.fullDateTime}). The user is in timezone: ${d.timezone}`;
        }
    }
    addCustomContext(key, value){
        this.globalData[key] = value;
    }
    getFullContextString(){
        return JSON.stringify(this, null, 2);
    }
    getGlobalContextString(){
        return JSON.stringify(this.globalData, null, 2);
    }
    getToolContextString(){
        return JSON.stringify(this.toolData, null, 2);
    }
    getSingleToolContext(toolID){
        if(typeof toolID === "string" && toolID != ""){
            let toolData = this.toolData[toolID] ?? null;
            return toolData;
        }
    }
}