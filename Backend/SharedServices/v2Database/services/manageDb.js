import { dbURL, dbURL_Fallback, namespaceName, databaseName } from '../core/constants.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export let DATABASE_AGENT = null;
// Safely extract the constructor depending on how Node resolved the module

/** Create Database Agent
 * @param {boolean} offline                       - Offline = true for no when there is no docker environment / doing testing.
 * @param {object} [options]
 * @param {string} [options.optAttemptNumber]     - For counting the number of re-attempts. Only to be used for testing.
 * @returns {Result{ ok: bool, value: object } }  -  object = SurrealDB object
 */
async function createDbAgent(offline = false, options = {}) {
  const { Surreal } = await import('surrealdb');
  let db = new Surreal();
  // use regular user not root! 
  const dbUser = process.env.dbRegularUser;
  const dbPass = process.env.dbRegularPass;
  try {
    // Connect to the SurrealDB instance
    let url = offline ? dbURL_Fallback : dbURL;
    await db.connect(url, {
      namespace: namespaceName,
      database: databaseName
    });
    // Authenticate as 'Database' level user (non-root!)
    await db.signin({
        namespace: namespaceName,
        database: databaseName,
        username: dbUser,
        password: dbPass
      });
    await db.use({ namespace: namespaceName, database: databaseName });
    DATABASE_AGENT = db; // update global dbAgent var;
    return Services.v2Core.Helpers.Ok(db);
  } catch (error) {
    // Try fallback DB URL - once!
    const { optAttemptNumber } = options;
    if (optAttemptNumber == null || optAttemptNumber == undefined) {
      let dbAgent2 = await createDbAgent(true, {optAttemptNumber: 1}); // attempt number stops never ending loop!
      if (dbAgent2.isOk()) {
        return dbAgent2;
      }
    }
    // else return the original error
    return Services.v2Core.Helpers.Err(`Error (createDbAgent) - ${error}`);
  }
}

export async function closeDatabaseConnection() {
  if (DATABASE_AGENT) {
    await DATABASE_AGENT.close();
  }
}

export async function initDatabaseConnection(offline = false) {
  let db = await createDbAgent(offline);
  return db; // returning Ok/ Err for app.js init 
}

export async function getDbAgent() {
  if (DATABASE_AGENT != null) {
    return Services.v2Core.Helpers.Ok(DATABASE_AGENT);
  } else {
    // dbAgent not created yet
    let outcome = await createDbAgent();
    if (outcome.isOk()) {
      return outcome;
    } else {
      return Services.v2Core.Helpers.Err(`Error (getDbAgent -> createDbAgent) : ${outcome.value}`);
    }
  }
}