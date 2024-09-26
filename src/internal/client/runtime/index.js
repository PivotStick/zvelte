import * as $ from "svelte/internal/client";
import { filters } from "./filters.js";
import { getInitialLoad } from "./hydration.js";
import {
    PROPS_IS_BINDABLE,
    PROPS_IS_IMMUTABLE,
    PROPS_IS_RUNES,
    PROPS_IS_UPDATED,
} from "../../../compiler/phases/constants.js";

export { mount, hydrate } from "svelte";
export * from "svelte/internal/client";
export { setInitialLoads } from "./hydration.js";

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
    if (value?.constructor === Object) return Object.values(value);

    if (Array.isArray(value)) {
        const out = [];
        for (const key in value) {
            if (value.hasOwnProperty(key)) {
                out.push(value[key]);
            }
        }
        return out;
    }

    return Array.from(value);
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

        if (!response.ok || response.redirected) {
            if (
                !response.redirected &&
                response.headers.get("content-type") === "application/json"
            ) {
                throw await response.json();
            }

            throw response;
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

    let promise = $.state(
        initialLoad ? Promise.resolve(initialLoad) : get(payload),
    );

    let loading = $.state(!initialLoad);
    let error = $.state(null);

    let initialLoading = loading.v;

    if (initialLoad) {
        setter(initialLoad);
    }

    $.user_effect(() => {
        $.set(error, null);
        $.set(loading, initialLoading);

        $.get(promise)
            .then(setter)
            .catch((/** @type {any} */ value) => $.set(error, value))
            .finally(() => {
                $.set(loading, false);
                initialLoading = true;
            });
    });

    return {
        get loading() {
            return $.get(loading);
        },

        get error() {
            return $.get(error);
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

/**
 * @param {any} $$props
 */
export function wrap($$props) {
    $$props ??= {};
    const flags =
        PROPS_IS_IMMUTABLE |
        PROPS_IS_RUNES |
        PROPS_IS_UPDATED |
        PROPS_IS_BINDABLE;

    const cache = Object.keys($$props).reduce((o, key) => {
        o[key] = $.prop($$props, key, flags);
        return o;
    }, /** @type {Record<string, any>} */ ({}));

    /** @type {Record<string, any>} */
    const custom = {};

    /**
     * @param {string} key
     */
    const get = (key) => {
        if (key in custom)
            return function (/** @type {any} */ v) {
                if (arguments.length > 0) {
                    return (custom[key] = v);
                }

                return custom[key];
            };

        return (cache[key] ??= $.prop($$props, key, flags));
    };

    return new Proxy($$props, {
        defineProperty(target, property, attributes) {
            if (typeof property === "symbol")
                return Reflect.defineProperty(target, property, attributes);

            return Reflect.defineProperty(custom, property, attributes);
        },
        get(target, p, receiver) {
            if (typeof p === "symbol") return Reflect.get(target, p, receiver);

            return get(p)();
        },
        set(target, p, newValue, receiver) {
            if (typeof p === "symbol")
                return Reflect.set(target, p, newValue, receiver);

            get(p)($.proxy(newValue));
            return true;
        },
        deleteProperty(target, p) {
            if (typeof p === "symbol") return Reflect.deleteProperty(target, p);

            custom[p] = undefined;
            cache[p] = undefined;
            return delete $$props[p];
        },
        has(target, p) {
            return p in cache || p in custom || p in target;
        },
        ownKeys(_target) {
            const keys = Object.keys({
                ...$$props,
                ...custom,
                ...cache,
            });

            return keys;
        },
        getOwnPropertyDescriptor(target, p) {
            if (typeof p === "symbol")
                return Reflect.getOwnPropertyDescriptor(target, p);

            return (
                Reflect.getOwnPropertyDescriptor($$props, p) ||
                Reflect.getOwnPropertyDescriptor(cache, p) ||
                Reflect.getOwnPropertyDescriptor(custom, p)
            );
        },
    });
}
