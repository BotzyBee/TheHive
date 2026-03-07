import {
  dbURL,
  dbURL_Fallback,
  namespaceName,
  databaseName
} from '../../constants.js';
import { Surreal } from 'surrealdb';
import dotenv from 'dotenv';
import * as su from '../Utils/index.js';

let DATABASE_AGENT = null;

/** Create Database Agent
 * @param {boolean} offline                       - Offline = true for no when there is no docker environment / doing testing.
 * @param {object} [options]
 * @param {string} [options.optAttemptNumber]     - For counting the number of re-attempts. Only to be used for testing.
 * @returns {Result{ ok: bool, value: object } }  -  object = SurrealDB object
 */
async function createDbAgent(offline = false, options = {}) {
  let db = new Surreal();
  dotenv.config({ path: '.env' });
  const dbUser = process.env.dbRootUser;
  const dbPass = process.env.dbRootPass;
  try {
    // Connect to the SurrealDB instance
    let url = offline ? dbURL_Fallback : dbURL;
    await db.connect(url);
    // Authenticate as a root user (required to define namespaces and databases)
    await db.signin({
      username: dbUser,
      password: dbPass,
    });
    await db.use({ namespace: namespaceName, database: databaseName });
    DATABASE_AGENT = db; // update global dbAgent var;
    return su.Ok(db);
  } catch (error) {
    // Try fallback DB URL - once!
    const { optAttemptNumber } = options;
    if (optAttemptNumber == null || optAttemptNumber == undefined) {
      let dbAgent2 = await createDbAgent(true, {optAttemptNumber: 1}); // attempt number stops never ending loop!
      if (dbAgent2.isOk()) {
        return su.Ok(dbAgent2);
      }
    }
    // else return the original error
    return su.logAndErr(`Error (createDbAgent) - ${error}`);
  }
}

export async function closeDatabaseConnection() {
  if (DATABASE_AGENT) {
    await DATABASE_AGENT.close();
  }
}

export async function initDatabaseConnection(offline = false) {
  let db = await createDbAgent(offline);
  if (db.isOk()) {
    DATABASE_AGENT = db.value;
  }
  return db;
}

export async function getDbAgent() {
  if (DATABASE_AGENT != null) {
    return su.Ok(DATABASE_AGENT);
  } else {
    // dbAgent not created yet
    let outcome = await createDbAgent();
    if (outcome.isOk()) {
      return su.Ok(outcome.value);
    } else {
      return su.logAndErr(`Error (getDbAgent -> createDbAgent) : ${outcome.value}`);
    }
  }
}