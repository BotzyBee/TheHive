/**
 * Generate Long ID
 * @param {string} prefix - optional prefix to the ID number
 * @returns {string} - example output ${prefix}-xxxx-xxxx-xxxx
 */
export function generateLongID(prefix) {
  if (!prefix) prefix = 'AI';
  return `${prefix}-****-****-****`.replace(/[*y]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == '*' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate Short ID (Action ID)
 * @param {string} prefix - optional prefix to the ID number
 * @returns {string} - example output Action-xxxx
 */
export function generateShortID(prefix) {
  if (!prefix) prefix = 'Action';
  return `${prefix}_****`.replace(/[*y]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == '*' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a simple random reference string of specified length.
 * @param {number} length - length of the random hex string
 * @returns {string} - example output Action-xxxx
 */
export function generateSimpleRef(length = 4) {
  // Create a string of asterisks based on the desired length
  const mask = '*'.repeat(length);
  const randomPart = mask.replace(/[*]/g, () => {
    const r = (Math.random() * 16) | 0;
    return r.toString(16);
  });
  return randomPart;
}

/**
 * Formats a given number of bytes into a human-readable string (e.g., KB, MB, GB).
 * @param {number} bytes - The size in bytes.
 * @param {number} decimals - The number of decimal places to include (default is 2).
 * @returns {string} The formatted file size.
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 *
 * @param {Buffer, Uint8Array, or ArrayBuffer} input
 * @returns {string} - Base64 string
 */
export function toBase64(input) {
  if (input instanceof ArrayBuffer) {
    input = Buffer.from(new Uint8Array(input));
  } else if (input instanceof Uint8Array) {
    input = Buffer.from(input);
  } else if (!Buffer.isBuffer(input)) {
    Err(
      'Error (toBase64) : Unsupported input type. Use Buffer, Uint8Array, or ArrayBuffer.'
    );
  }
  return Ok(input.toString('base64'));
}

export function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Converts a Base64 string or Data URI to a Node.js Buffer.
 * @param {string} base64String - The raw base64 or data:image/... string.
 * @returns {Buffer} - The decoded binary data.
 */
export function base64ToBuffer(base64String) {
  // Check if it's a Data URI (contains a comma)
  const hasMetadata = base64String.includes(',');

  // If it's a Data URI, split it and take the second part (the actual data)
  const pureBase64 = hasMetadata ? base64String.split(',')[1] : base64String;

  return Buffer.from(pureBase64, 'base64');
}

/**
 * @param {string | object | array | boolean} value
 * @returns {string} - Returns a stringified version of the input data.
 */
export function escapeStringValues(value) {
  if (typeof value === 'string') {
    const quoted = JSON.stringify(value);
    return quoted.slice(1, -1);
  } else if (Array.isArray(value)) {
    return value.map((item) => escapeStringValues(item));
  } else if (value !== null && typeof value === 'object') {
    for (const key in value) {
      if (!value.hasOwnProperty(key)) continue;
      value[key] = escapeStringValues(value[key]);
    }
  }
  return value;
}
