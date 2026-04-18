import { writable, get } from 'svelte/store';
import { io } from 'socket.io-client';

// We track both the socket instance and the connection status
export const socketStatus = writable({
    connected: false,
    id: null
});

export const socketStore = writable(null);

export const initSocket = (url) => {
    // Prevent multiple initializations
    const existingSocket = get(socketStore);
    if (existingSocket) return existingSocket;

    const socket = io(url, {
        autoConnect: true, // Let it connect immediately or manually via socket.connect()
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    // Listen for core lifecycle events
    socket.on('connect', () => {
        socketStatus.set({ connected: true, id: socket.id });
    });

    socket.on('disconnect', () => {
        socketStatus.set({ connected: false, id: null });
    });

    socket.on('connect_error', (error) => {
        console.error('Socket Connection Error:', error);
        socketStatus.set({ connected: false, id: null });
    });

    socketStore.set(socket);
    return socket;
};

/**
 * Helper to ensure the socket is connected before emitting
 */
export const emitSocket = (event, data, callback) => {
    const s = get(socketStore);
    if (s && s.connected) {
        s.emit(event, data, callback);
    } else {
        console.error(`Cannot emit ${event}: Socket not connected.`);
    }
};

// Socket initialization moved to onMount in the layout to ensure it's available globally and only initialized once when the app loads.
export function refreshSocket() {
    const backendUrl = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
    const socket = initSocket(backendUrl); 
    socket.connect();
}