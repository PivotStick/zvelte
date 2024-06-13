import { filters } from "./filters.js";

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
 * @param {Record<string, any>[]} scopes
 * @param {string} key
 */
export function filter(scopes, key) {
    return scope([filters, ...scopes], key);
}

/**
 * @param {*} value
 */
export function iterable(value) {
    if (value && typeof value === "object") {
        if (Array.isArray(value)) {
            const out = [];
            for (const key in value) {
                if (value.hasOwnProperty(key)) {
                    out.push(value[key]);
                }
            }
            return out;
        }

        return Object.values(value);
    }

    return value;
}

/**
 * @param {() => number} index
 * @param {() => unknown[]} array
 * @param {any} parent
 */
export function loop(index, array, parent) {
    return {
        get index() {
            return index() + 1;
        },
        get index0() {
            return index();
        },
        get revindex() {
            return array().length - index();
        },
        get revindex0() {
            return array().length - index() - 1;
        },
        get first() {
            return index() === 0;
        },
        get last() {
            return index() === array().length - 1;
        },
        get length() {
            return array().length;
        },
        get parent() {
            return parent;
        },
    };
}

export { in_expression as in };
