/**
 * @type {Record<string, any>}
 */
let initialLoads = {};

/**
 * @param {typeof initialLoads} value
 */
export function setInitialLoads(value) {
    initialLoads = value;
}

/**
 * @param {string} key
 */
export function getInitialLoad(key) {
    const init = initialLoads[key];
    initialLoads[key] = undefined;
    return init;
}
