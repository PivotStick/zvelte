import * as $ from "svelte/internal/client";
import { filters } from "./filters.js";

export { mount, hydrate } from "svelte";
export { append_styles } from "../shared.js";
export * from "svelte/internal/client";

/**
 * @param {Record<string, any>[]} scopes
 */
export function scope(scopes) {
    /**
     * @param {string} key
     */
    return (key, fallback = scopes[0]) => {
        for (let i = scopes.length - 1; i >= 0; i--) {
            const scope = scopes[i];
            if (key in scope) return scope;
        }

        return fallback;
    };
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
 * @param {ReturnType<typeof scope> | Record<string, any>} scope
 * @param {string} key
 */
export function filter(scope, key) {
    if (typeof scope === "function") {
        return scope(key, filters);
    }

    return scope[key] ? scope : filters;
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

/**
 * @param {string} endpoint
 * @param {Record<string, any>} payload
 * @param {(data: any) => void} setter
 */
export function load(endpoint, payload, setter) {
    async function get() {
        const search = new URLSearchParams(payload);
        const response = await fetch(endpoint + "?" + search, {
            headers: {
                accept: "application/json",
            },
        });

        if (!response.ok) {
            if (response.headers.get("content-type") === "application/json") {
                throw new Error(await response.text());
            }

            throw new Error(response.statusText);
        }

        return response.json();
    }

    let promise = $.source(get());

    return {
        get() {
            return $.get(promise);
        },
        /**
         * @type {import("../types.js").ComponentInitAsyncArgs<any>["refresh"]}
         */
        async refresh(newPayload = payload, full = false) {
            payload = newPayload;

            if (!full) {
                const data = await get();
                setter(data);
                return data;
            }

            return await $.set(promise, get());
        },
    };
}

export { in_expression as in };
