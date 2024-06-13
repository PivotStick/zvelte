import { getFilter } from "./filters.js";

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

/**
 * @param {any} value
 */
export function is_empty(value) {
    if (Array.isArray(value)) {
        return !value.length;
    } else if (value !== null && typeof value === "object") {
        return !Object.keys(value).length;
    } else {
        return !value;
    }
}

/**
 * @param {string} key
 * @param {...*} args
 */
export function filter(key, ...args) {
    const fn = getFilter(key);
    return fn(...args);
}

/**
 * @param {*} value
 */
export function iterable(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.values(value);
    }

    return value;
}

export { in_expression as in };
