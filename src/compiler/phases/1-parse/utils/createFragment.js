/**
 * @returns {import("#ast").Fragment}
 */
export function createFragment(transparent = false) {
    return {
        type: "Fragment",
        nodes: [],
        start: -1,
        end: -1,
        transparent,
    };
}
