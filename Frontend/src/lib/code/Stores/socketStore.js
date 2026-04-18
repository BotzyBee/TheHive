import { writable, get } from 'svelte/store';
import { io } from 'socket.io-client';

/**
 * Factory for creating a collection of socket stores based on routes.
 * @param {string[]} routesArray - Example: ['/', '/chat_botzy']
 * @param {string} baseUrl - The base URL of your socket server
 */
function createSocketStore(routesArray) {
    const baseUrl = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
    let socketCollection = {};

    // Fix: Use routesArray.length for the loop condition
    for (let i = 0; i < routesArray.length; i++) {
        const route = routesArray[i];

        const socketStore = () => {
            // This store will hold the actual socket instance
            const { subscribe, set, update } = writable(null);
            let connectedStore = writable(false);
            return {
                // 2. Expose the connection store for Svelte reactivity ($ prefix)
                connected: { subscribe: connectedStore.subscribe },

                /**
                 * 3. ADDED METHOD: Returns the current raw boolean value
                 * Useful for logic inside non-Svelte files or event handlers
                 */
                isConnected: () => get(connectedStore),
                subscribe,
                /**
                 * Initializes the connection for this specific route
                 */
                connect: (opts = {}) => {
                    // Prevent duplicate connections if one already exists
                    if (get({ subscribe })) return;

                    const socket = io(`${baseUrl}${route}`, opts);

                    socket.on('connect', () => {
                        connectedStore.set(true);
                        set(socket);
                    });

                    socket.on('disconnect', () => {
                        connectedStore.set(false);
                        set(null);
                    });

                    return socket;
                },
                /**
                 * Generic emit helper
                 */
                send: (event, data, response) => {
                    const socket = get({ subscribe });
                    if (socket) {
                        socket.emit(event, data, response);
                    } else {
                        console.warn(`Socket for ${route} is not connected.`);
                    }
                },
                /**
                 * Manually close the connection
                 */
                close: () => {
                    const socket = get({ subscribe });
                    if (socket) {
                        socket.close();
                        connectedStore.set(false);
                        set(null);
                    }
                }
            };
        };

        // Initialize the handler for this route
        socketCollection[route] = socketStore();
    }

    return socketCollection;
}

export const socketRoutes = ['/', '/chat_botzy'];
export const sockets = createSocketStore(socketRoutes);

// USAGE
// const chatSocket = sockets['/chat_botzy'];
//     // Start the connection
//     chatSocket.connect();
//     function sendMessage() {
//         chatSocket.send('message', 'Hello Botzy!');
//     }


