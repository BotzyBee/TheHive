export const namespaceName = 'BotzyBee';
export const databaseName = 'TheHive';
export const dirTableName = 'Directories';
export const fileTableName = 'Files';
export const mgmtTableName = 'mgmtData';
export const vectorTableName = 'FileVectors';
export const toolTableName = 'ToolVectors';
export const guideTableName = 'GuideVectors';
export const modelTableName = 'ModelRegistry';
export const vectorEmbedSize = 1024;

// "http://indexdb:8000/rpc"; (live-inter-container) | "http://127.0.0.1:8000/rpc" (testing from CLI)
export const dbURL = "ws://indexdb:8000"; //'http://indexdb:8000/rpc';
export const dbURL_Fallback = 'http://127.0.0.1:8000/rpc';
export const N8N_Url = 'http://n8n:5678/'
export const N8N_ToolDirectoryUrl = 'http://n8n:5678/webhook/ToolDirectory';