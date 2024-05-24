export { mount, hydrate } from "svelte";
export * from "svelte/internal/client";

/**
 * @param {Record<string, any>[]} scopes
 * @param {string} key
 */
export function scope(scopes, key) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        const scope = scopes[i];
        if (key in scope) return scope;
    }

    return {};
}
