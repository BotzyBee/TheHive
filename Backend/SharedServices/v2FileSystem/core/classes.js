export class FileRegistry {
  constructor() {
    this.definitions = [];
    this.mimeIndex = new Map();
    this.extIndex = new Map();
  }

  register(config) {
    this.definitions.push(config);

    // Index all associated MIME types
    config.mimes.forEach((mime) => this.mimeIndex.set(mime, config));

    // Index all associated Extensions
    config.exts.forEach((ext) => this.extIndex.set(ext, config));
  }

  getByMime(mime) {
    return this.mimeIndex.get(mime) || this.getDefaultFallback(mime);
  }

  getByExt(ext) {
    // Remove dot if passed (e.g., ".txt" -> "txt")
    const cleanExt = ext.replace(/^\./, '');
    return this.extIndex.get(cleanExt) || this.getDefaultFallback();
  }

  getDefaultFallback(mime = '') {
    if (mime.startsWith('text/')) return this.getByExt('txt');
    if (mime.startsWith('image/')) return this.getByExt('png');
    return this.getByExt('bin'); // Ultimate fallback
  }
}
