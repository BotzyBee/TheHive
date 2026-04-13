export let connectedSockets = [];

export let io; // Declare io here to be initialized later in app.js

// helper function to emit to a specific socket (used for pushing updates to the correct user for their jobs)
export const emitToSocket = (socketId, event, data) => {
  const socket = io.sockets.sockets.get(socketId); 
  if (socket) {
    socket.emit(event, data);
  } else {
    log(`Warning: Socket ${socketId} not found for event "${event}"`);
  }
};