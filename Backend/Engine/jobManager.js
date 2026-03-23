import { AiJob } from "../SharedServices/Classes/index.js";
import { Services } from "../SharedServices/index.js";
import { useMultipleThreads } from "../SharedServices/constants.js";
import { pool, processObjectToClass } from "./workers.js";
import { FrontendMessageFormat } from "../SharedServices/Classes/aiMessages.js";

// Flow overview
// CreateJob (individual Routes) -> Push to JOB_LIST & ID to NON_ALLOC -> timer(checkNonAlloc)
// -> allocateAndProgress -> .run() on the job class -> User then polls till complete / failed. 

class AI_JOB_MANAGER{
    #allocatingJobs;
    #workerThreads
    constructor(){
        this.AI_JOBS = []; // aiJob Objects
        this.NON_ALLOCATED = []; // id's of non-allocated jobs.
        this.#allocatingJobs = false; // if true the allocTimer is processing a job. Stops timer stacking multiple calls!
        this.#workerThreads = false; // useMultipleThreads; // if true, job manager will use multiple threads to progress jobs.
    }
    /**
     * Adds a new AI Job to the queue.
     * @param {AiJob} aiJobClass - Any job that impliments the aiJobClass & .run() method.
     */
    addNewJob(aiJobClass){
        if(aiJobClass instanceof AiJob){
            this.AI_JOBS.push(aiJobClass);
            this.NON_ALLOCATED.push(aiJobClass.id);
            Services.Utils.Ok('Job Added');
        } 
        return Services.Utils.Err('Error (AI_JOB_MANAGER -> addNewJob) : input must be an instance of AiJob or SubClass of it.')
    }

    /**
     * Checks for job id's in NON_ALLOCADED and passes them to a dispatcher.
     * @returns {Result<string>} - Result(string)
     */
    async checkNonAllocated(){
        let jobsAwaiting = this.NON_ALLOCATED.length;
        if(jobsAwaiting == 0) { return Services.Utils.Ok('No Jobs To Allocate'); }
        this.#allocatingJobs = true;
        // take all outstanding jobs
        let tempJobs = this.NON_ALLOCATED; // Job IDs
        this.NON_ALLOCATED = [];
        let jobArray = [];
        for(let i in tempJobs ){
            jobArray.push( 
                this.allocateAndProgress(this.#workerThreads, tempJobs[i])
            );
        }
        Services.Utils.log(`Allocating ${jobsAwaiting} new Jobs`);
        let resultArray = await Promise.all(jobArray);
        // Update main thread
        let errorList = []; // hopefully nothing in here!
        for(let i in resultArray){
            if(resultArray[i].isErr()){
                errorList.push(resultArray[i].value);
            } 
        }
        if(errorList.length != 0 ){
            this.#allocatingJobs = false;
            return Services.Utils.Err(`Error (checkNonAllocated -> allocateAndProgress ) : ${JSON.stringify(errorList)}`)
        }
        this.#allocatingJobs = false;
        return Services.Utils.Ok('All Non-allocated jobs progressed');
    }

    /**
     * Progresses the allocated job. Not normally called directly!
     * @param {boolean} workerThreads - if true job will be carried out in a new thread 
     * @param {string} jobID - the job that will be pushed forward (calls run() on the class ) 
     * @returns {Result} - Result(string) - Job ID of the completed job.
     */
    async allocateAndProgress(workerThreads = false, jobID){
        // Catch input param issues
        if(jobID == undefined){ return Err("Error (allocateAndProgress) - JobID missing from input params") }
        // Fetch job object from this.AI_JOBS
        let fetchCall = this.jobListManager( { getJob: jobID } )
        if(fetchCall.isErr()){ return Services.Utils.Err(`Error (allocateAndProgress -> jobListManager) : ${fetchCall.value}`)}
        /**@type {AiJob} */
        let jobClassObject = fetchCall.value;
        let processCall;
        Services.Utils.log(`Progressing ${jobClassObject.agentType} - ${jobID}`);
        if(workerThreads == false){
            // process on main thread
            processCall = await jobClassObject.run();
            if(processCall.isErr()){
                const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
                const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/FailedJobs/');
                Services.FileSystem.saveFile(
                    targetDirectoryInContainer, 
                    JSON.stringify(jobClassObject, null, 2), 
                    `${jobClassObject.id}_Failed.txt`
                );
                return Services.Utils.logAndErr(`Error (allocateAndProgress -> run( ${jobClassObject.id} ) ) ${processCall.value}`)
            }   
        } else {
        // Offload to own thread
            // Check pool is active
            if(pool.threads?.length == 0 || pool.closed){
                return Services.Utils.logAndErr('Error (allocateAndProgress) : Worker Pool is offline!')
            }
            processCall = await pool.run({ jobClassObject }, { name: 'poolRunAiJob' }); 
            //processCall ERROR
            if(processCall.outcome == 'Error'){ // cant use .isErr() as pool is stringifying the result!
                // NOTE - Non-standard error {errorText: string, jobObject: object }
                const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
                const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/FailedJobs/');
                Services.FileSystem.saveFile(
                    targetDirectoryInContainer, 
                    JSON.stringify(processCall.value.jobObject, null, 2), 
                    `${processCall.value.jobObject.id}_Failed.txt`
                );
                return Err(`Error (allocateAndProgress -> pool run() ) ${processCall.value.errorText}`)
            }
            // Process back to class
            let jobOutcome = processObjectToClass(processCall.value);
            // Push update to job (doesn't update directly due to handoff to thread)
            let update = this.jobListManager({ replaceJob: jobOutcome })
            if(update.isErr()){
                return Services.Utils.logAndErr(`Error (allocateAndProgress -> jobListManager(replace) ) ${update.value}`);
            }
        }// end else
        Services.Utils.log(`Job Complete - ${jobID}`);  
        return Services.Utils.Ok(jobID);
    }

    /**
     * Performs CRUD operations on AI_JOBS array.
     * @param {array} list - pass either NON_ALLOCATED or AI_JOBS array here.
     * @param {object} params
     * @param {AiJob} [params.insertJob] - Inserts AiJob or any sub-class of AiJob
     * @param {string} [params.deleteJob] - deletes the specified job by id
     * @param {string} [params.stopJob] - stops the specified job by id 
     * @param {string} [params.getJob] - returns the aiJob object matching the specified id
     * @param {AiJob} [params.replaceJob] - adds/ replaces any matching aiJobs 
     * @returns {Result}
     */
    jobListManager( params = {}) {
        const { insertJob, deleteJob, stopJob, getJob, replaceJob } = params;
        this.AI_JOBS
        // INSERT
        if (insertJob) {
            if (this.AI_JOBS.some(job => job.id === insertJob.id)) {
                return Services.Utils.Err(`Error (jobListManager): Record ${insertJob.id} already exists.`);
            }
            this.AI_JOBS.push(insertJob);
            return Services.Utils.Ok(`ID ${insertJob.id} added.`);
        }

        // DELETE
        if (deleteJob) {
            const index = this.AI_JOBS.findIndex(job => job.id === deleteJob);
            if (index !== -1) {
                this.AI_JOBS.splice(index, 1);
                return Services.Utils.Ok(`ID ${deleteJob} removed.`);
            }
            return Services.Utils.Ok(`Ref not found.`);
        }

        // STOP
        if (stopJob) {
            const job = this.AI_JOBS.find(job => job.id === stopJob);
            if (job) {
                job.status.setStoppedByUser();
                return Services.Utils.Ok(`ID ${stopJob} Stopped`);
            }
            return Services.Utils.Err(`Error (jobListManager): Could not find ID: ${stopJob}`);
        }

        // GET
        if (getJob) {
            const job = this.AI_JOBS.find(job => job.id === getJob);
            return job ? Services.Utils.Ok(job) : Services.Utils.Err(`Error (jobListManager): Could not find ID: ${getJob}`);
        }

        // REPLACE
        if (replaceJob) {
            const index = this.AI_JOBS.findIndex(job => job.id === replaceJob.id);
            if (index !== -1) {
                this.AI_JOBS[index] = replaceJob; // Direct replacement is cleaner than splice + push
            } else {
                this.AI_JOBS.push(replaceJob);
            }
            return Services.Utils.Ok(`ID ${replaceJob.id} has been replaced/added`);
        }
        return Services.Utils.Err("Error (jobListManager): No valid operation provided.");
    }

    /**
     * Main method for getting the result of a job or an update on status.
     * @param {string} jobID - Which job to lookup. 
     * @returns {Result<FrontendMessageFormat>} - Returns Result(FrontendMessageFormat)
     */
    getUpdateOrResult(jobID){
        if(jobID == null){
            return Services.Utils.Err('Error (getUpdateOrResult) : JobID Missing or null');
        }
        let data = this.jobListManager({getJob: jobID});
        if(data.isErr()){
          return Services.Utils.Err(`Error (getUpdateOrResult -> jobListManager) : ${data.value}`);  
        }
        let msg = new FrontendMessageFormat({ 
            aiJobId: jobID, 
            status: data.value.status, 
            isRunning: data.value.isRunning,
            messages: data.value.taskOutput, 
            metadata: data.value.stats
            });

        return Services.Utils.Ok(msg);
    }

    // HANDLE MESSAGE TO AGENT
    // Inject Message, push id to unalloc -> picked up by allocator? 

    isAllocatorActive(){
        return this.#allocatingJobs;
    }
}

export let JOBS = new AI_JOB_MANAGER(); // Active or completed JOBS