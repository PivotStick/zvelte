export { mount, hydrate } from "svelte";
export * from "svelte/internal/client";

/**
 * @param {Record<string, any>[]} scopes
 * @param {string} key
 */
export function scope(scopes, key, fallback = {}) {
    for (let i = scopes.length - 1; i >= 0; i--) {
        const scope = scopes[i];
        if (key in scope) return scope;
    }

    return fallback;
}

/**
 * @param {any} left
 * @param {any} right
 */
function in_expression(left, right) {
    if (Array.isArray(right)) {
        return right.includes(left);
    } else if (typeof right === "object" && right !== null) {
        return left in right;
    }
}

export { in_expression as in };
