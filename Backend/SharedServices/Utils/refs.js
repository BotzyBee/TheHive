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
