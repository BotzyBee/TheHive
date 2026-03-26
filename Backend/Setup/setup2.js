import { Surreal } from "surrealdb";
import dotenv from 'dotenv';
import { namespaceName, databaseName, dirTableName, 
    fileTableName, vectorTableName, vectorEmbedSize, 
    mgmtTableName, toolTableName, guideTableName } from "../SharedServices/constants.js";
import { addDirectoryToDB } from "../SharedServices/Database/CRUD.js";

// Setup Namespace, Database and tables
export async function setupFolderBotDB() {
    const db = new Surreal();
    dotenv.config({ path: ".env" });
    const dbUser = process.env.dbRootUser;
    const dbPass = process.env.dbRootPass;
    const dbUserRegular = process.env.dbRegularUser;
    const dbPassRegular = process.env.dbRegularPass;
    const rootDirUrl = process.env.knowledgebaseURL;

    try {
        // Connect to the SurrealDB instance
        await db.connect("http://127.0.0.1:8000/rpc"); 
        // Authenticate as a root user (required to define namespaces and databases)
        await db.signin({
            username: dbUser,
            password: dbPass,
        });

        // --- Create Namespace if it doesn't exist ---
        await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespaceName};`);
        await db.use({ namespace: namespaceName });

        // --- Create Database if it doesn't exist ---
        await db.query(`DEFINE DATABASE IF NOT EXISTS ${databaseName};`);

        // --- Now use both the namespace and database ---
        await db.use({ namespace: namespaceName, database: databaseName });

        // Define the schema for the 'Directories' table
        await db.query(`
            DEFINE TABLE ${dirTableName} SCHEMAFULL;
            DEFINE FIELD DirRef ON TABLE ${dirTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD ParentDirRef ON TABLE ${dirTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Url ON TABLE ${dirTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD LastUpdate ON TABLE ${dirTableName} TYPE int ASSERT $value >= 0;
            DEFINE FIELD Meta ON TABLE ${dirTableName} FLEXIBLE TYPE object;
        `);

        // Create an index on Directories table
        await db.query(`
            DEFINE INDEX uniqueDirRef ON TABLE ${dirTableName} COLUMNS DirRef UNIQUE;
            DEFINE INDEX uniqueDirUrl ON TABLE ${dirTableName} COLUMNS Url UNIQUE;
            DEFINE INDEX parentDirIndex ON TABLE ${dirTableName} COLUMNS ParentDirRef;
        `);
        console.log(`${dirTableName} Table and Index setup on ${databaseName}`);

        // Define the schema for the 'Files' table
        await db.query(`
            DEFINE TABLE ${fileTableName} SCHEMAFULL;
            DEFINE FIELD DirRef ON TABLE ${fileTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD FileRef ON TABLE ${fileTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Url ON TABLE ${fileTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD FileType ON TABLE ${fileTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD LastUpdate ON TABLE ${fileTableName} TYPE int ASSERT $value >= 0;
            DEFINE FIELD Meta ON TABLE ${fileTableName} FLEXIBLE TYPE object;
        `);

        // Create an index on FILES table
        await db.query(`
            DEFINE INDEX uniqueFileRef ON TABLE ${fileTableName} COLUMNS FileRef UNIQUE;
            DEFINE INDEX dirIndex ON TABLE ${fileTableName} COLUMNS DirRef;
            DEFINE INDEX uniqueUrl ON TABLE ${fileTableName} COLUMNS Url UNIQUE;
        `);
        console.log(`${fileTableName} Table and Index setup on ${databaseName}`);
        
        // Create management Data table
        await db.query(`
            DEFINE TABLE ${mgmtTableName} SCHEMALESS;
            DEFINE FIELD lastIndexCheckMs ON TABLE ${mgmtTableName} TYPE int;
            DEFINE FIELD toolSettings ON TABLE ${mgmtTableName} FLEXIBLE TYPE object;
        `);
        // Populate init mgmt data
        await db.query(`
            INSERT INTO ${mgmtTableName} {
                lastIndexCheckMs: 0,
                toolSettings: {}
            };
        `);
        
        // Add Root Dir Record
        await addDirectoryToDB(db, rootDirUrl,"N/A", 999, {});

        // Define the schema for the File Vector Table
        await db.query(`
            DEFINE TABLE ${vectorTableName} SCHEMAFULL;
            DEFINE FIELD DirRef ON TABLE ${vectorTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD FileRef ON TABLE ${vectorTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Url ON TABLE ${vectorTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Summary ON TABLE ${vectorTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Vector ON TABLE ${vectorTableName} TYPE array<float>  ASSERT $value != NONE;
           
        `); //  DEFINE FIELD Vector.* ON TABLE ${vectorTableName} TYPE float;
        
        // Define Index for File Vector DB
        await db.query(`
            DEFINE INDEX HNSW_VECTOR_INDEX ON TABLE ${vectorTableName}
            FIELDS Vector HNSW
            DIMENSION ${vectorEmbedSize}
            DIST COSINE
            TYPE F32;
        `);
        console.log(`${vectorTableName} table and index created.`)

        // Define the schema for the Tool Vector Table
        await db.query(`
            DEFINE TABLE ${toolTableName} SCHEMAFULL;
            DEFINE FIELD ToolName ON TABLE ${toolTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD ToolDescription ON TABLE ${toolTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Version ON TABLE ${toolTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD FilePath ON TABLE ${toolTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Vector ON TABLE ${toolTableName} TYPE array<float>  ASSERT $value != NONE;
           
        `); //  DEFINE FIELD Vector.* ON TABLE ${vectorTableName} TYPE float;
        
        // Define Index for File Vector DB
        await db.query(`
            DEFINE INDEX HNSW_VECTOR_INDEX ON TABLE ${toolTableName}
            FIELDS Vector HNSW
            DIMENSION ${vectorEmbedSize}
            DIST COSINE
            TYPE F32;
        `);
        console.log(`${toolTableName} table and index created.`);

        // Define the schema for the Guide Vector Table
        await db.query(`
            DEFINE TABLE ${guideTableName} SCHEMAFULL;
            DEFINE FIELD GuideName ON TABLE ${guideTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD GuideDescription ON TABLE ${guideTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Version ON TABLE ${guideTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD FilePath ON TABLE ${guideTableName} TYPE string ASSERT $value != NONE;
            DEFINE FIELD Vector ON TABLE ${guideTableName} TYPE array<float>  ASSERT $value != NONE;
           
        `); //  DEFINE FIELD Vector.* ON TABLE ${vectorTableName} TYPE float;
        
        // Define Index for File Vector DB
        await db.query(`
            DEFINE INDEX HNSW_VECTOR_INDEX ON TABLE ${guideTableName}
            FIELDS Vector HNSW
            DIMENSION ${vectorEmbedSize}
            DIST COSINE
            TYPE F32;
        `);
        console.log(`${guideTableName} table and index created.`);
        
        // Add 'Normal User' on database. https://surrealdb.com/docs/surrealql/statements/define/user
        await db.query(`
            DEFINE USER ${dbUserRegular} ON DATABASE PASSWORD '${dbPassRegular}' ROLES OWNER DURATION FOR SESSION 1d, FOR TOKEN 1d;
        `);
        console.log(`User ${dbUserRegular} created with OWNER permissions on database level.`);

    } catch (error) {
        //console.error('Error setting up SurrealDB:', error);
        throw new Error(error);
    } finally {
        db.close(); 
    }
}
