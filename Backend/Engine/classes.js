

import { fileTableName, dirTableName } from '../SharedServices/constants.js';
import { log } from '../SharedServices/Utils/misc.js';
import { 
  addFileToDB, 
  addDirectoryToDB, 
  updateRecords, 
  deleteRecordsByField, 
  getDirsAndFilesRecursive 
} from '../SharedServices/Database/CRUD.js';


// [][] -- Change Job - Used to update DB with file/ Dir changes -- [][]
export class indexJob {
  constructor(url) {
    this.url = url; // URLs should only use forward-slashes /
    this.attemptNumber = 0;
    this.errorThrown = false;
    this.errorText = [];
  }

  async addFileToDB(dbAgent, dirRef, fileType, updateMillis, metaObj) {
    let res = await addFileToDB(
      dbAgent,
      dirRef,
      this.url,
      fileType,
      updateMillis,
      metaObj
    );
    if (res.isErr()) {
      log(`Error indexJob (addFileToDB) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.attemptNumber += 1;
      this.errorThrown = true;
      this.errorText.push(res.value);
      this.jobType = 'addFile';
    }
    return this; // return this for chaining calls.
  }

  async addDirToDB(dbAgent, parentDirRef, updateMillis, metaObj) {
    let res = await addDirectoryToDB(
      dbAgent,
      this.url,
      parentDirRef,
      updateMillis,
      metaObj
    );
    if (res.isErr()) {
      log(`Error indexJob (addDirToDB) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.attemptNumber += 1;
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async updateDbFile(dbAgent, updateData) {
    // upadate data = object of keys/ values to be updated
    // eg {LastUpdate: 123, Meta: { tags: ["cheese", "potato"] } }
    let res = await updateRecords(
      dbAgent,
      fileTableName,
      'Url',
      this.url,
      updateData
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      log(`Error indexJob (updateDbFile -> updateRecords) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async updateDbDir(dbAgent, updateData) {
    // upadate data = object of keys/ values to be updated
    // eg {LastUpdate: 123, Meta: { tags: ["cheese", "potato"] } }
    let res = await updateRecords(
      dbAgent,
      dirTableName,
      'Url',
      this.url,
      updateData
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      log(`Error indexJob (updateDbDir -> updateRecords) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async removeFileFromDB(dbAgent) {
    let res = await deleteRecordsByField(
      dbAgent,
      fileTableName,
      'Url',
      this.url
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      log(`Error indexJob (removeFileFromDB -> deleteRecordsByField) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async removeDirFromDB(dbAgent) {
    // Get any sub-dirs or sub-files which also should be removed
    let allSubs = await getDirsAndFilesRecursive(dbAgent, this.url);
    if (allSubs.isErr()) {
      this.attemptNumber += 1;
      log(`Error indexJob (removeDirFromDB -> getDirsAndFilesRecursive) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${allSubs.value}`);
      this.errorThrown = true;
      this.errorText.push(allSubs.value);
    }
    let i;
    const allDirsLen = allSubs.value.directoryList.length ?? 0;
    const allFileLen = allSubs.value.fileList.length ?? 0;
    // iterate over Dirs
    for (i = 0; i < allDirsLen; i++) {
      let allDirRes = await deleteRecordsByField(
        dbAgent,
        dirTableName,
        'Url',
        allSubs.value.directoryList[i].Url
      );
      if (allDirRes.isErr()) {
        this.attemptNumber += 1;
        log(`Error indexJob (removeDirFromDB -> deleteRecordsByField ${i}) : 
                    attempt: ${this.attemptNumber}
                    url: ${this.url} 
                    error text : ${allDirRes.value}`);
        this.errorThrown = true;
        this.errorText.push(allDirRes.value);
      }
    }

    // iterate over Files
    for (i = 0; i < allFileLen; i++) {
      let allFileRes = await deleteRecordsByField(
        dbAgent,
        fileTableName,
        'Url',
        allSubs.value.fileList[i].Url
      );
      if (allFileRes.isErr()) {
        this.attemptNumber += 1;
        log(`Error indexJob (removeDirFromDB -> deleteRecordsByField(2) ${i}) : 
                    attempt: ${this.attemptNumber}
                    url: ${this.url} 
                    error text : ${allFileRes.value}`);
        this.errorThrown = true;
        this.errorText.push(allFileRes.value);
      }
    }

    // Delete Root Dir
    let res = await deleteRecordsByField(
      dbAgent,
      dirTableName,
      'Url',
      this.url
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      log(`Error indexJob (removeDirFromDB -> deleteRecordsByField) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }
}



