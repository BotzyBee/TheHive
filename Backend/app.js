import { initRegistry } from './ApiHelpers/buildRegistry.js';

console.log('BOOTSTRAPPING THE HIVE BACKEND...');
// Build the registry completely
initRegistry();

// Dynamically import the rest of the application
await import('./appServer.js');
