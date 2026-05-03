import path from 'path';
import { Services } from '../../index.js';
import { guideTableName, vectorEmbedSize } from '../core/constants.js';
import {
  getRecords,
  addVectorGuideToDB,
  deleteRecordsByField,
  getAllRecordsFromTable,
} from './CRUD.js';

export async function fetchPluginAgentGuides() {
  let tool = Services.fileSystem.CRUD.scanFolderRecursively;
  let call = await tool(`${Services.fileSystem.Constants.pluginDir}/Guides/`);
  if (call.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error (fetchPluginAgentGuides -> scanFolderRecursively ) : ${call.value}`
    );
  }
  let allFiles = call.value.fileList ?? [];
  let allFilesLen = allFiles.length ?? 0;
  if (allFilesLen == 0) {
    return Services.v2Core.Helpers.Ok([]);
  }

  //Fetch Tools
  let results = [];
  for (let i = 0; i < allFilesLen; i++) {
    // read
    if (allFiles[i].includes('.txt')) {
      let fp = path.join(
        Services.fileSystem.Constants.containerVolumeRoot,
        allFiles[i]
      );
      const readFile = await Services.fileSystem.CRUD.readFileContent(fp);
      if (readFile.isErr()) {
        return readFile;
      }
      const fileStats =
        await Services.fileSystem.CRUD.getUpdateStatsFromUrl(fp);
      if (fileStats.isErr()) {
        return fileStats;
      }
      results.push({
        filePath: fp,
        guideName: allFiles[i],
        version: JSON.stringify(fileStats.value.mtimeMs), // use modified time as version
        overview: 'No-overview-provided',
        content: readFile.value,
      });
    }
  }
  return Services.v2Core.Helpers.Ok(results);
}

export async function initGuideIndex() {
  // Find all guides and add them to the database.
  let plugIn = await fetchPluginAgentGuides();
  if (plugIn.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( initGuideIndex -> fetchPluginAgentGuides ) : ${plugIn.value}`
    );
  }
  // Process them into the DB (check if exist, check new version, add if needed);
  const cLen = plugIn.value.length ?? 0;
  let getDB = await Services.database.ManageDb.getDbAgent();
  if (getDB.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( initGuideIndex -> getDbAgent ) : ${getDB.value}`
    );
  }
  const db = getDB.value;
  let stats = { guides: 0, added: 0, updated: 0, removed: 0 };
  for (let i = 0; i < cLen; i++) {
    console.log('Checking Guide : ', plugIn.value[i].guideName);
    // check if exists
    let check = await getRecords(
      db,
      guideTableName,
      'GuideName',
      plugIn.value[i].guideName
    );
    if (check.isErr()) {
      return Services.v2Core.Helpers.Err(
        `Error ( initGuideIndex -> getRecords ) : ${check.value}`
      );
    }
    // if exists - check if needs updated
    if (check.value[0].length != 0) {
      if (
        check.value[0][0].GuideName == plugIn.value[i].guideName &&
        check.value[0][0].Version != plugIn.value[i].version
      ) {
        let dCall = await removeGuideFromDB(db, plugIn.value[i].guideName);
        if (dCall.isErr()) {
          return Services.v2Core.Helpers.Err(
            `Error ( initGuideIndex -> removeGuideFromDB ) : ${dCall.value}`
          );
        }
        let aCall = await addGuideToDB(db, plugIn.value[i]);
        if (aCall.isErr()) {
          return Services.v2Core.Helpers.Err(
            `Error ( initGuideIndex -> addGuideToDB ) : ${aCall.value}`
          );
        }
        stats.updated++;
      }
    } else {
      // Doesn't exist - add it
      let aCall = await addGuideToDB(db, plugIn.value[i]);
      if (aCall.isErr()) {
        return Services.v2Core.Helpers.Err(
          `Error ( initGuideIndex -> addGuideToDB ) : ${aCall.value}`
        );
      }
      stats.added++;
    }
    stats.guides++;
  } // i

  // Check for deleted tools
  let checkDeleted = await checkForDeletedGuides(db, plugIn.value);
  if (checkDeleted.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( initGuideIndex -> checkForDeletedGuides ) : ${checkDeleted.value}`
    );
  }
  stats.removed = checkDeleted.value;
  return Services.v2Core.Helpers.Ok(stats);
}

/***
 * Adds guide to Guide Vector Table in the database.
 * @param {object} dbObject - DB agent - use getDbAgent() for this
 * @param {object} guideObject - { guideName: string, overview: string, version: string, filePath: string }
 */
async function addGuideToDB(dbObject, guideObject) {
  // create summary of the guide for embedding.
  let summary = await Services.aiAgents.AgentSharedServices.createSummary();
  if (summary.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( addGuideToDB -> createSummary ) : ${summary.value}`
    );
  }
  let ai = await Services.callAI.aiFactory();
  let vec = await ai.generateEmbeddings({
    inputDataVec: [summary.value],
    dimensionSize: vectorEmbedSize,
    quality: 1,
  });
  if (vec.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( addGuideToDB -> generateEmbeddings ) : ${vec.value}`
    );
  }
  let dbCall = await addVectorGuideToDB(
    dbObject,
    guideTableName,
    guideObject.guideName,
    summary.value,
    guideObject.version,
    guideObject.filePath,
    vec.value[0]
  );
  if (dbCall.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( addGuideToDB -> addVectorGuideToDB ) : ${dbCall.value}`
    );
  }
  return Services.v2Core.Helpers.Ok(null);
}

/**
 *
 * @param {object} dbObject - DB agent - use getDbAgent() for this
 * @param {string} guideName - name of the guide to be removed.
 * @returns {Result}
 */
async function removeGuideFromDB(dbObject, guideName) {
  let dbCall = await deleteRecordsByField(
    dbObject,
    guideTableName,
    'GuideName',
    guideName
  );
  if (dbCall.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( removeGuide -> deleteRecordsByField ) : ${dbCall.value}`
    );
  }
  return Services.v2Core.Helpers.Ok(null);
}

/**
 * @param {object} dbObject - DB agent - use getDbAgent() for this
 * @param {Array[object]} liveGuides -  [{ guideName: string, overview: string, version: string, filePath: string }, ...]
 * @returns {Result(number)} - the number of guides removed.
 */
async function checkForDeletedGuides(dbObject, liveGuides) {
  let dbCall = await getAllRecordsFromTable(dbObject, guideTableName);
  if (dbCall.isErr()) {
    return Services.v2Core.Helpers.Err(
      `Error ( initGuideIndex -> checkForDeletedGuides ) : ${dbCall.value}`
    );
  }
  // Check DB list against the 'live' tools found in folders.
  let tLen = dbCall.value.length ?? 0;
  let liveLen = liveGuides.length ?? 0;
  let deleteList = [];
  for (let i = 0; i < tLen; i++) {
    let dbGuide = dbCall.value[i].GuideName;
    let found = false;
    for (let k = 0; k < liveLen; k++) {
      if (liveGuides[k].guideName == dbGuide) {
        found = true;
        break;
      }
    }
    if (found == false) {
      deleteList.push(dbGuide);
    }
  }
  // Old DB guide not present in 'live' guides
  let dLen = deleteList.length ?? 0;
  let removed = 0;
  for (let i = 0; i < dLen; i++) {
    let call = await removeGuideFromDB(dbObject, deleteList[i]);
    if (call.isErr()) {
      return Services.v2Core.Helpers.Err(
        `Error ( initGuideIndex -> checkForDeletedGuides 2 ) : ${call.value}`
      );
    }
    removed++;
  }
  return Services.v2Core.Helpers.Ok(removed);
}
