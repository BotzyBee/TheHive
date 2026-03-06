import { dirTableName, fileTableName, mgmtTableName } from '../constants.js';
import { SharedUtils } from '../Utils/index.js';

let su = new SharedUtils();

// [][] -- CREATE -- [][]
export async function addDirectoryToDB(
  dbAgent,
  URL,
  parentDirRef,
  lastUpdateMillis,
  metaObj
) {
  let encodedURL = encodeURIComponent(URL);
  try {
    const dirRef = su.longID('DIR');
    let result = await dbAgent.query(
      `INSERT INTO ${dirTableName} {
                DirRef: '${dirRef}',
                ParentDirRef: $pdr,
                Url: $u,
                LastUpdate: $lu,
                Meta: $mo
                }`,
      {
        pdr: parentDirRef,
        u: encodedURL,
        lu: lastUpdateMillis,
        mo: metaObj,
      }
    );
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (addDirectoryToDB) : ${error}`);
  }
}

export async function addFileToDB(
  dbAgent,
  dirRef,
  URL,
  fileType,
  lastUpdateMillis,
  metaObj
) {
  let encodedURL = encodeURIComponent(URL);
  try {
    const filRef = su.longID('FIL');
    let result = await dbAgent.query(
      `
                INSERT INTO ${fileTableName} {
                    DirRef: $dr,
                    FileRef: $fr,
                    FileType: $ft,
                    Url: $u,
                    LastUpdate: $ud,
                    Meta: $m
                }`,
      {
        dr: dirRef,
        fr: filRef,
        u: encodedURL,
        ft: fileType,
        ud: lastUpdateMillis,
        m: metaObj, // does this need to be stringified?
      }
    );
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (addFileToDB) : ${error}`);
  }
}

// Add Vector To DB (File Vector)
export async function addVectorToDB(
  dbAgent,
  tableName,
  dirRef,
  fileRef,
  URL,
  summary,
  vector
) {
  let encodedURL = encodeURIComponent(URL);
  try {
    let result = await dbAgent.query(
      `
            INSERT INTO ${tableName} {
                DirRef: $dr,
                FileRef: $fr,
                Url: $u,
                Summary: $s,
                Vector: $v
            };
        `,
      {
        dr: dirRef,
        fr: fileRef,
        u: encodedURL,
        s: summary,
        v: vector, // Array of floats
      }
    );

    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (addVectorToDB) : ${error}`);
  }
}

// [][] -- READ -- [][]
export async function getRecords(dbAgent, tableName, searchField, searchTerm) {
  if (searchField === 'Url') {
    searchTerm = encodeURIComponent(searchTerm);
  }
  try {
    let query = `SELECT * FROM ${tableName} WHERE ${searchField} == $st`;
    let vars = { st: searchTerm };
    let result = await dbAgent.query(query, vars);
    // handle URI encoding -> decode for return
    let resLen = result[0]?.length ?? 0;
    if (resLen > 0) {
      // iterate, check & decode if needed
      result[0].forEach((obj, index) => {
        if (Object.keys(obj).includes('Url')) {
          // has Url key
          result[0][index]['Url'] = decodeURIComponent(result[0][index]['Url']);
        }
      });
    }
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`"Error (getRecords) : ${error}`);
  }
}

// For reading / searching vector records.
export async function searchVectorRecords(
  dbAgent,
  tableName,
  searchVector,
  limit = 5
) {
  try {
    // DESC for desending (ASC for ascending)
    let query = `
            SELECT *, vector::similarity::cosine(Vector, $sv) AS score 
            FROM ${tableName} 
            ORDER BY score DESC 
            LIMIT $limit
        `;

    let vars = {
      sv: searchVector,
      limit: limit,
    };

    let result = await dbAgent.query(query, vars);
    // Process the result set (result[0] in SurrealDB)
    let resLen = result[0]?.length ?? 0;
    if (resLen > 0) {
      result[0].forEach((obj, index) => {
        // Decode the URL for the frontend/client
        if (Object.keys(obj).includes('Url')) {
          result[0][index]['Url'] = decodeURIComponent(result[0][index]['Url']);
        }
      });
    }
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (searchVectors) : ${error}`);
  }
}

export async function getMgmtData(dbAgent) {
  try {
    let result = await dbAgent.query(`SELECT * FROM ${mgmtTableName}`);
    let resLen = result[0].length ?? 0;
    if (resLen == 0) {
      return su.logAndErr('Error (getMgmtData) : DB returned no records');
    }
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (getMgmtData) : ${error}`);
  }
}

export async function getRecordById(dbAgent, tableName, id) {
  // catch if full id is passed eg mgmtData:6p6808y0idt79iy63st2
  if (id.includes(':')) {
    let parts = id.split(':');
    tableName = parts[0];
    id = parts[1];
  }
  try {
    let query = `SELECT * FROM type::thing(${tableName},$id)`;
    let vars = { id: id };
    let result = await dbAgent.query(query, vars);
    // handle URI encoding -> decode for return
    let resLen = result[0]?.length ?? 0;
    if (resLen > 0) {
      // iterate, check & decode if needed
      result[0].forEach((obj, index) => {
        if (Object.keys(obj).includes('Url')) {
          // has Url key
          result[0][index]['Url'] = decodeURIComponent(result[0][index]['Url']);
        }
      });
    }
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (getRecordById) : ${error}`);
  }
}

// only returns one level.. not recursive!
export async function getDirsAndFilesFromUrl(dbAgent, Url) {
  let directoryList = [];
  let fileList = [];
  // Url must be a directory!
  let rootCheck = await getRecords(dbAgent, dirTableName, 'Url', Url); // Url doesn't need to be encoded prior to this call.
  // catch error
  if (rootCheck.isErr()) {
    return su.logAndErr(
      `Error (getAllDirAndFilesFromUrl -> getRecords(1) ) : ${rootCheck.value}`
    );
  }
  // catch no root Dir
  let retLen = rootCheck.value[0].length ?? 0;
  if (retLen == 0) {
    return su.result_ok({ directoryList: [], fileList: [] });
  }
  // root directory exists.. search for files and sub-directories
  let dirRef = rootCheck.value[0][0].DirRef;
  let subFolders = await getRecords(
    dbAgent,
    dirTableName,
    'ParentDirRef',
    dirRef
  );
  // catch error
  if (subFolders.isErr()) {
    return su.logAndErr(
      `Error (getAllDirAndFilesFromUrl -> getRecords(2) ) : ${subFolders.value}`
    );
  }
  // extract any sub-directories
  directoryList = subFolders.value[0];
  // search for files
  let files = await getRecords(dbAgent, fileTableName, 'DirRef', dirRef);
  // catch error
  if (files.isErr()) {
    return su.logAndErr(
      `Error (getAllDirAndFilesFromUrl -> getRecords(3) ) : ${files.value}`
    );
  }
  // extract any files
  fileList = files.value[0];
  // return results
  return su.result_ok({ directoryList, fileList });
}

// Recursive - doesn't include input Dir Url in results.
export async function getDirsAndFilesRecursive(dbAgent, Url) {
  let directoryList = [];
  let fileList = [];
  // Url must be a directory!
  let rootCheck = await getRecords(dbAgent, dirTableName, 'Url', Url);
  // catch error
  if (rootCheck.isErr()) {
    return su.logAndErr(
      `Error (getAllDirAndFilesFromUrl -> getRecords(1) ) : ${rootCheck.value}`
    );
  }
  // catch no root Dir
  let retLen = rootCheck.value[0].length ?? 0;
  if (retLen == 0) {
    return su.result_ok({ directoryList: [], fileList: [] });
  }
  // root directory exists.. search for files and sub-directories
  let dirRef = rootCheck.value[0][0].DirRef;
  let subFolders = await getRecords(
    dbAgent,
    dirTableName,
    'ParentDirRef',
    dirRef
  );
  // catch error
  if (subFolders.isErr()) {
    return su.logAndErr(
      `Error (getAllDirAndFilesFromUrl -> getRecords(2) ) : ${subFolders.value}`
    );
  }
  // extract any sub-directories
  directoryList = subFolders.value[0];
  // search for files
  let files = await getRecords(dbAgent, fileTableName, 'DirRef', dirRef);
  // catch error
  if (files.isErr()) {
    return su.logAndErr(
      `Error (getAllDirAndFilesFromUrl -> getRecords(3) ) : ${files.value}`
    );
  }
  // extract any files
  fileList = files.value[0];

  // Recursive calls on sub-directories
  let dirListLen = directoryList.length ?? 0;
  let i;
  let newDirList = [];
  for (i = 0; i < dirListLen; i++) {
    const subCall = await getDirsAndFilesRecursive(
      dbAgent,
      directoryList[i].Url
    );
    if (subCall.isErr()) {
      return su.logAndErr(
        `Error - getDirsAndFilesRecursive -> Recursive call error ${subCall.value}`
      );
    }
    fileList = fileList.concat(subCall.value.fileList);
    newDirList = newDirList.concat(subCall.value.directoryList);
  }
  // merge all
  directoryList = directoryList.concat(newDirList);
  // return results
  return su.result_ok({ directoryList, fileList });
}

// [][] -- UPDATE -- [][]
export async function updateRecords(
  dbAgent,
  tableName,
  searchField,
  searchTerm,
  updateData
) {
  // upadate data = object of keys/ values to be updated
  // eg {LastUpdate: 123, Meta: { tags: ["cheese", "potato"] } }
  if (searchField === 'Url') {
    searchTerm = encodeURIComponent(searchTerm);
  }
  try {
    const query = `
            UPDATE ${tableName} 
            SET ${Object.keys(updateData)
              .map((key) => `${key} = $${key}`)
              .join(', ')}
            WHERE ${searchField} = $value
            RETURN AFTER
        `;
    const vars = { value: searchTerm, ...updateData };
    const result = await dbAgent.query(query, vars);
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (updateRecords) : ${error}`);
  }
}

export async function updateMgmtData(dbAgent, updateData) {
  // updateData = object of keys/values to be updated
  // e.g., {LastUpdate: 123, Meta: { tags: ["cheese", "potato"] } }
  try {
    const query = `
            UPDATE ${mgmtTableName} 
            SET ${Object.keys(updateData)
              .map((key) => `${key} = $${key}`)
              .join(', ')}
            RETURN AFTER
        `;

    const vars = { ...updateData }; // Directly use updateData for the variables
    const result = await dbAgent.query(query, vars);
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (updateMgmtData) : ${error}`);
  }
}

// [][] -- DELETE -- [][]
export async function deleteRecordsByField(
  dbAgent,
  tableName,
  fieldName,
  fieldValue
) {
  // NOTE - No need to escape URL if used!!
  if (fieldName === 'Url') {
    fieldValue = encodeURIComponent(fieldValue);
  }
  try {
    let result = await dbAgent.query(
      `DELETE FROM ${tableName} WHERE ${fieldName} = $value RETURN BEFORE`,
      { value: fieldValue }
    );
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (deleteRecordByField) : ${error}`);
  }
}

// Note idRef is just the 2nd half of the full ref - eg f4639pd6zvvftrgqb9u2 from Vectors:f4639pd6zvvftrgqb9u2
export async function deleteRecordsById(dbAgent, tableName, idRef) {
  try {
    let result = await dbAgent.query(
      `DELETE ${tableName}:${idRef} RETURN BEFORE`
    );
    return su.result_ok(result);
  } catch (error) {
    return su.logAndErr(`Error (deleteRecordsById) : ${error}`);
  }
}
