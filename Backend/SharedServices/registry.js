class ServiceRegistry {
  constructor() {
    this.services = new Map();
  }

  /**
   * Register a service instance.
   * @param {string} name 
   * @param {object} instance 
   */
  register(name, instance) {
    if (this.services.has(name)) {
      console.warn(`Service "${name}" is being overwritten.`);
    }
    this.services.set(name, instance);
  }

  /**
   * Retrieve a service. Throws error if not found.
   */
  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`ServiceRegistry Error: "${name}" has not been registered yet.`);
    }
    return service;
  }
}

// Export a singleton instance
export const registry = new ServiceRegistry();