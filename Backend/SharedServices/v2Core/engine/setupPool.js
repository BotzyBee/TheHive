/*
METRICS: 
pool.threads.length	The current number of physical worker threads spawned.
pool.queueSize	Number of tasks waiting for an available thread.
pool.utilization	A value between 0 and 1 representing how busy the pool is.
pool.waitTime	Performance metrics on how long tasks sit in the queue.
*/

import { Piscina } from 'piscina';
import { io } from '../../../ApiHelpers/socketHelpers.js';
import { isMainThread } from 'worker_threads';

/**@type {Piscina} */
export let pool; // Piscina worker pool (multi-thread)

// Setup the worker pool
export function setupPool() {
  console.log('Setting up Worker Pool');
  if (isMainThread) {
    pool = new Piscina({
      filename: new URL('./workers.js', import.meta.url).href,
      minThreads: 2, // Minimum number of worker threads to keep alive
      maxThreads: 4, // Maximum number of worker threads
    });

    // Listen for messages from workers and pass on
    pool.on('message', (msg) => {
      // io is your Socket.io instance on the main thread
      const socket = io.value.sockets.sockets.get(msg.socketId);
      if (socket) {
        socket.emit(msg.event, msg.data);
      } else {
        console.log(
          `Warning: Socket ${msg.socketId} not found for event "${msg.event}"`
        );
      }
    });
  }
}
