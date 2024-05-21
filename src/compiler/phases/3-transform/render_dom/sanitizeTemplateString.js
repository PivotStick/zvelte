/**
 * @param {string} str
 * @returns {string}
 */
export function sanitizeTemplateString(str) {
    return str.replace(/(`|\${|\\)/g, "\\$1");
}
