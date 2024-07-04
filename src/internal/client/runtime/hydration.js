/**
 * @type {any[]}
 */
let initialLoads = [];
let initialLoadsIndex = 0;

/**
 * @param {any[]} value
 */
export function setInitialLoads(value) {
    initialLoads = value;
}

export function getInitialLoad() {
    if (initialLoadsIndex < initialLoads.length) {
        return initialLoads[initialLoadsIndex++];
    }
}
