import { writable, get } from 'svelte/store';
import { io } from 'socket.io-client';

function createSocketStore(routesArray) {
    const baseUrl = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
    let socketCollection = {};

    for (const route of routesArray) {
        // The actual Svelte store holding the socket instance
        const { subscribe, set } = writable(null);
        const connectedStore = writable(false);
        
        // Private variable to track the instance inside this closure
        let instance = null;

        socketCollection[route] = {
            subscribe,
            connected: { subscribe: connectedStore.subscribe },
            isConnected: () => get(connectedStore),

            connect: (opts = {}) => {
                // 1. Immediate check: if instance exists, don't create another
                if (instance) return instance;
                
                // 2. Create instance immediately
                instance = io(`${baseUrl}${route}`, {
                    ...opts,
                    autoConnect: true // socket.io connects by default
                });

                instance.on('connect', () => {
                    connectedStore.set(true);
                    set(instance); // Update the store for Svelte components
                });

                instance.on('disconnect', () => {
                    connectedStore.set(false);
                    // We don't set(null) here because the instance still exists 
                    // and will try to auto-reconnect.
                });

                return instance;
            },

            send: (event, data, callback) => {
                // Use the closure instance directly
                if (instance && instance.connected) {
                    instance.emit(event, data, callback);
                } else {
                    console.warn(`Socket for ${route} is not ready. State: ${instance?.connected}`);
                }
            },

            close: () => {
                if (instance) {
                    instance.close();
                    instance = null;
                    set(null);
                    connectedStore.set(false);
                }
            }
        };
    }

    return socketCollection;
}

export const socketRoutes = ['/', '/chat_botzy'];
export const sockets = createSocketStore(socketRoutes);