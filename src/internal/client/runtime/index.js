import * as $ from "svelte/internal/client";
import { filters } from "./filters.js";
import { getInitialLoad } from "./hydration.js";

export { mount, hydrate } from "svelte";
export { append_styles } from "../shared.js";
export * from "svelte/internal/client";
export { setInitialLoads } from "./hydration.js";

/**
 * The proxy handler for spread props. Handles the incoming array of props
 * that looks like `() => { dynamic: props }, { static: prop }, ..` and wraps
 * them so that the whole thing is passed to the component as the `$$props` argument.
 * @template {Record<string | symbol, unknown>} T
 * @type {ProxyHandler<{ props: Array<T | (() => T)>, default: any; }>}}
 */
const spread_props_handler = {
    get(target, key) {
        let i = target.props.length;
        while (i--) {
            let p = target.props[i];
            if (typeof p === "function") p = p();
            if (typeof p === "object" && p !== null && key in p) return p[key];
        }

        return target.default[key];
    },
    set(target, key, newValue, receiver) {
        for (let p of [...target.props, target.default]) {
            if (typeof p === "function") p = p();
            if (p != null && key in p) {
                p[key] = newValue;
                return true;
            }
        }

        return false;
    },
    getOwnPropertyDescriptor(target, key) {
        let i = target.props.length;
        while (i--) {
            let p = target.props[i];
            if (typeof p === "function") p = p();
            if (typeof p === "object" && p !== null && key in p)
                return Object.getOwnPropertyDescriptor(p, key);
        }

        return Object.getOwnPropertyDescriptor(target.default, key);
    },
    has(target, key) {
        for (let p of target.props) {
            if (typeof p === "function") p = p();
            if (p != null && key in p) return true;
        }

        return key in target.default;
    },
    ownKeys(target) {
        /** @type {Array<string | symbol>} */
        const keys = [];

        for (let p of [...target.props, target.default]) {
            if (typeof p === "function") p = p();
            for (const key in p) {
                if (!keys.includes(key)) keys.push(key);
            }
        }

        return keys;
    },
};

/**
 * @param {Array<Record<string, unknown> | (() => Record<string, unknown>)>} props
 * @returns {any}
 */
export function spread_props(...props) {
    return new Proxy({ props, default: {} }, spread_props_handler);
}

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
            const notUndefined = scope[key] !== undefined;
            if (key in scope || notUndefined) return scope;
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
 */
export function create_load(endpoint) {
    /**
     * @param {Record<string, any>=} payload
     */
    return async (payload) => {
        const search = new URLSearchParams(payload ?? {}).toString();
        const response = await fetch(endpoint + (search ? "?" + search : ""), {
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
    };
}

/**
 * @param {ReturnType<typeof create_load>} get
 * @param {Record<string, any>} payload
 * @param {Record<string, any> | undefined} $$initialLoad
 * @param {(data: any) => void} setter
 */
export function init_load(get, payload, $$initialLoad, setter) {
    const initialLoad = getInitialLoad() ?? $$initialLoad;

    let promise = $.source(
        initialLoad ? Promise.resolve(initialLoad) : get(payload),
    );
    let loading = $.source(!initialLoad);

    let initialLoading = $.unwrap(loading);

    if (initialLoad) {
        setter(initialLoad);
    }

    $.user_effect(() => {
        $.set(loading, initialLoading);
        $.get(promise)
            .then(setter)
            .finally(() => {
                $.set(loading, false);
                initialLoading = true;
            });
    });

    return {
        get loading() {
            return $.get(loading);
        },

        /**
         * @type {import("../types.js").ComponentInitAsyncArgs<any>["refresh"]}
         */
        async refresh(newPayload = payload, full = false) {
            payload = newPayload;

            if (!full) {
                const data = await get(payload);
                setter(data);
                return data;
            }

            return await $.set(promise, get(payload));
        },
    };
}

export { in_expression as in };
