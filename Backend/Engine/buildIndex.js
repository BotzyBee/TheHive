// STARTED - NOT COMPLETE !!

// Index knowledgebase
import dotenv from 'dotenv';
import { Ok, Err, indexJob } from '../sharedTypes.js';
import {
  getRecords,
  getDirsAndFilesFromUrl,
  updateMgmtData,
  createDbAgent,
} from '../DB/CRUD.js';
import { getFilesAndDirectoriesFromDir } from '../fileStore/CRUD.js';
import { dirTableName } from '../constants.js';
import { SharedUtils } from '../SharedServices/Utils/index.js';

let su = new SharedUtils();

let indexingActive = false;
let furtherChecks = []; // array of sub-directory Urls needing indexed
let deleteJobs = []; // array of files + dirs to be deleted from DB
let deleteJobsReadable = []; // human readable version for error su.logging

// Indexing Stats
let kbTotal = 0; // knowledgebase checks
let dbTotal = 0; // database checks
let totalJobCount = 0; // total number of jobs completed

export async function indexKnowledgebase(dbAgent) {
  // Index in progress. Catch repeat timer calls & exit early
  if (indexingActive == true) {
    return su.result_ok('Indexing is already in progress.');
  }
  // reset Index Stats
  kbTotal = 0;
  dbTotal = 0;
  totalJobCount = 0;
  // clear working arrays
  furtherChecks = [];
  deleteJobs = [];
  deleteJobsReadable = [];

  // Check update millis
  let MsNow = new Date().getTime(); // for updating mgmt record when done. \
  // Begin index from root
  indexingActive = true;
  dotenv.config({ path: '.env' });
  const kbURL = process.env.knowledgebaseURL;
  let rootUpdates = await checkAndUpdateDirAndFiles(dbAgent, kbURL);
  if (rootUpdates.isErr()) {
    indexingActive = false;
    return su.logAndErr(
      `Error indexKnowledgebase -> checkAndUpdateDirAndFiles(Root) ${rootUpdates.value}`
    );
  }
  su.log(rootUpdates.value);

  // Complete furtherChecks
  let furtherChecksNeeded = furtherChecks.length ?? 0;
  let i = 0;
  while (i < furtherChecksNeeded) {
    let nextUpdateDir = await checkAndUpdateDirAndFiles(
      dbAgent,
      furtherChecks[i]
    );
    if (nextUpdateDir.isErr()) {
      indexingActive = false;
      return su.logAndErr(
        `Error indexKnowledgebase -> checkAndUpdateDirAndFiles(index ${i}) ${nextUpdateDir.value}`
      );
    }
    furtherChecksNeeded = furtherChecks.length ?? 0; // update len with any new dirs found
    su.log(nextUpdateDir.value);
    i++;
  }

  // Process delete actions
  let deleteActions = await processDeleteJobs();
  if (deleteActions.isErr()) {
    return su.logAndErr(
      `Error (indexKnowledgebase -> processDeleteJobs) : ${deleteActions}`
    );
  }

  // Update mgmt record with last change time for root directory
  let updateMgmtRec = await updateMgmtData(dbAgent, {
    lastIndexCheckMs: MsNow,
  });
  if (updateMgmtRec.isErr()) {
    indexingActive = false;
    su.logAndErr(
      `Error (indexKnowledgebase) - Could not update Mgmt Record : ${updateMgmtRec.value}`
    );
  }

  // set indexing Active false
  indexingActive = false;
  su.log(`Indexing Complete: 
        Filesystem hits: ${kbTotal}
        Database hits: ${dbTotal}
        Changes made: ${totalJobCount}`);
  return su.result_ok('All files/ Directories Indexed');
}

async function checkAndUpdateDirAndFiles(dbAgent, Url) {
  // Url MUST be a Directory!!
  // This function handles changes HOWEVER delete actions (deleteJobs) MUST be
  // handled after this fn has completed -due to removed records causing issues with recursive calls.
  // Delete jobs are stored in the global deleteJobs array.

  let changeList = [];
  let changeListReadable = [];
  let dbDirs = [];
  let dbFiles = [];
  let kbDirs = [];
  let kbFiles = [];

  // Get this Url's Dir Ref
  let getRec = await getRecords(dbAgent, dirTableName, 'Url', Url);
  if (getRec.isErr()) {
    return su.logAndErr(
      `Error (checkAndUpdateDirAndFiles -> getRecords ) : ${getRec.value}`
    );
  }
  let getRecLen = getRec.value[0].length ?? 0;
  if (getRecLen == 0) {
    return su.logAndErr(
      `Error (checkAndUpdateDirAndFiles -> getRecords ) : No record found for Url ${Url}. Unable to progress!`
    );
  }
  let thisDirRef = getRec.value[0][0].DirRef;
  // Get data from database
  let subDirsFiles = await getDirsAndFilesFromUrl(dbAgent, Url);
  // catch error
  if (subDirsFiles.isErr()) {
    return su.logAndErr(
      `Error (checkAndUpdateDirAndFiles -> getDirsAndFilesFromUrl ) : ${subDirsFiles.value}`
    );
  }
  // DB Known Files + Directories
  dbDirs = subDirsFiles.value.directoryList;
  dbFiles = subDirsFiles.value.fileList;

  // Get data from knowledgebase
  let kbFilDir = await getFilesAndDirectoriesFromDir(Url);
  // catch error
  if (kbFilDir.isErr()) {
    return su.logAndErr(
      `Error (checkAndUpdateDirAndFiles -> getFilesAndDirectoriesFromDir) : ${kbFilDir}`
    );
  }
  kbDirs = kbFilDir.value.directoryList;
  kbFiles = kbFilDir.value.fileList;
  let kbFileCount = kbFiles.length ?? 0;
  let dbFileCount = dbFiles.length ?? 0;
  let kbDirCount = kbDirs.length ?? 0;
  let dbDirCount = dbDirs.length ?? 0;
  let i, k;
  let found;

  // console.su.log(`KB Files : ${kbFileCount}, KB Dirs : ${kbDirCount}`);
  // console.su.log(`DB Files : ${dbFileCount}, DB Dirs : ${dbDirCount}`);

  // Knowledgebase structs
  // NOTE kbDirs List is an array of {url: String, updateMs: Int}
  // NOTE kbFiles is an array of object :
  // {
  // fileName: String,
  // fileUrl: String,
  // fileType: String,
  // updateMs: Int
  // }

  // Database structs
  // NOTE dbDirs is an array of directory records :
  // {
  //     DirRef: String,
  //     LastUpdate: Int,
  //     Meta: Object,
  //     ParentDirRef: String,
  //     Url: String
  // }
  // NOTE dbFiles is an array of file records :
  // {
  //     DirRef: String,
  //     FileRef: String,
  //     FileType: String,
  //     LastUpdate: Int,
  //     Meta: Object,
  //     Url: String
  // }

  // iterate over KB Files
  for (i = 0; i < kbFileCount; i++) {
    found = false;
    // check against DB Known
    for (k = 0; k < dbFileCount; k++) {
      // URL Match
      if (kbFiles[i].fileUrl == dbFiles[k].Url) {
        // check update time
        if (kbFiles[i].updateMs != dbFiles[k].LastUpdate) {
          // Push UPDATE to changeList (Update DB)
          changeList.push(
            new indexJob(dbFiles[k].Url).updateDbFile(dbAgent, {
              LastUpdate: kbFiles[i].updateMs,
            })
          );
          changeListReadable.push(`
                            Update DB File
                            Url: ${dbFiles[k].Url}
                            Data: ${{ LastUpdate: kbFiles[i].updateMs }}
                        `);
        }
        found = true;
        break;
      }
    }
    if (found == false) {
      // Push ADD to changeList (Add to DB)
      changeList.push(
        new indexJob(kbFiles[i].fileUrl).addFileToDB(
          dbAgent,
          thisDirRef,
          kbFiles[i].fileType,
          kbFiles[i].updateMs,
          {}
        )
      );
      changeListReadable.push(`
                Add File to DB
                Url: ${kbFiles[i].fileUrl}
                DirRef: ${thisDirRef}
                Type: ${kbFiles[i].fileType}
                UpdateMs: ${kbFiles[i].updateMs}
                Meta: {}
                `);
    }
  }

  // iterate over KB Dirs
  for (i = 0; i < kbDirCount; i++) {
    found = false;
    // check against DB Known
    for (k = 0; k < dbDirCount; k++) {
      // URL Match
      if (kbDirs[i].url == dbDirs[k].Url) {
        // check update time
        if (kbDirs[i].updateMs != dbDirs[k].LastUpdate) {
          // Push UPDATE to changeList (Update DB)
          changeList.push(
            new indexJob(kbDirs[i].url).updateDbDir(dbAgent, {
              LastUpdate: kbDirs[i].updateMs,
            })
          );
          changeListReadable.push(`
                        Update DB Directory
                        Url: ${kbDirs[i].url}
                        UpdateMs: ${kbDirs[i].updateMs}
                    `);
          // Push Next Dir to furtherChecks list
          furtherChecks.push(kbDirs[i].url);
        }
        found = true;
      }
    }
    if (found == false) {
      // Push ADD to changeList (Add to DB)
      changeList.push(
        new indexJob(kbDirs[i].url).addDirToDB(
          dbAgent,
          thisDirRef,
          kbDirs[i].updateMs,
          {}
        )
      );
      changeListReadable.push(`
                Add Dir to DB
                Url: ${kbDirs[i].url}
                ParentDirRef: ${thisDirRef}
                UpdateMs: ${kbDirs[i].updateMs} 
                `);
      // push Dir to furtherChecks list
      furtherChecks.push(kbDirs[i].url);
    }
  }

  // Check for deleted Files
  // NOTE these are dealt with after all checkAndUpdateDirAndFiles calls have completed
  for (i = 0; i < dbFileCount; i++) {
    found = false;
    // check against KB Found
    for (k = 0; k < kbFileCount; k++) {
      // URL Match
      if (dbFiles[i].Url == kbFiles[k].fileUrl) {
        found = true;
        break;
      }
    }
    if (found == false) {
      // File no longer exists in KB
      // Push delete to deleteJobs (Remove from DB)
      deleteJobs.push(new indexJob(dbFiles[i].Url).removeFileFromDB(dbAgent));
      deleteJobsReadable.push(`
                Remove File from DB
                Url: ${dbFiles[i].Url}
            `);
    }
  }

  // Check for deleted Directories
  for (i = 0; i < dbDirCount; i++) {
    found = false;
    // check against KB Found
    for (k = 0; k < kbDirCount; k++) {
      // URL Match
      if (dbDirs[i].Url == kbDirs[k].url) {
        found = true;
        break;
      }
    }
    if (found == false) {
      // Dir no longer exists in KB
      // Push delete to deleteJobs (Remove from DB)
      deleteJobs.push(new indexJob(dbDirs[i].Url).removeDirFromDB(dbAgent));
      deleteJobsReadable.push(`
                Remove Dir from DB
                Url: ${dbDirs[i].Url}
            `);
    }
  }

  // Process changeList
  let jobCount = changeList.length ?? 0;
  let jobComplete;
  for (i = 0; i < jobCount; i++) {
    jobComplete = false;
    // Gives 3 attempts at each job
    for (k = 0; k < 3; k++) {
      let job = await changeList[i];
      if (job.errorThrown == false) {
        jobComplete = true;
        break; // job completed without error
      }
    }
    if (jobComplete == false) {
      return su.logAndErr(`Error (checkAndUpdateDirAndFiles) :
                Failed to complete indexJob after 3 attempts
                Dir Url : ${Url}
                indexJob : ${changeListReadable[i]}
            `);
    }
  }

  kbTotal += kbFileCount + kbDirCount;
  dbTotal += dbFileCount + dbDirCount;
  totalJobCount += jobCount;
  return su.result_ok(`Directory indexed : ${Url}`);
}

async function processDeleteJobs() {
  // Process Delete List
  let deleteJobCount = deleteJobs.length ?? 0;
  let deleteJobComplete;
  let i, k;
  for (i = 0; i < deleteJobCount; i++) {
    deleteJobComplete = false;
    // Gives 3 attempts at each job
    for (k = 0; k < 3; k++) {
      let job = await deleteJobs[i];
      if (job.errorThrown == false) {
        deleteJobComplete = true;
        break; // job completed without error
      }
    }
    if (deleteJobComplete == false) {
      return su.logAndErr(`Error (processDeleteJobs) :
                Failed to complete indexJob after 3 attempts
                indexJob : ${deleteJobsReadable[i]}
            `);
    }
  }
  totalJobCount += deleteJobCount;
  return su.result_ok('Delete Jobs Completed');
}
