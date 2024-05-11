/**
 * @returns {import("#ast").Fragment}
 */
export function createFragment() {
    return {
        type: "Fragment",
        nodes: [],
        start: -1,
        end: -1,
    };
}
