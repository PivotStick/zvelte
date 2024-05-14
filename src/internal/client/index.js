/**
 * @template [T = any]
 * @template {Record<string, HTMLElement>} [Els = Record<string, HTMLElement>]
 * @typedef {import("./types.js").ComponentInitArgs<T, Els>} Args
 */

export { getComponentByKey } from "./runtime/components.js";
export { registerFilter, getFilter } from "./runtime/filters.js";
export { mount, createComponent } from "./dom/mount.js";
export { onMount, onDestroy, tick } from "svelte";
export { user_effect as effect } from "svelte/internal/client";

import * as $ from "svelte/internal/client";

/**
 * @template T
 * @param {T} initial
 * @returns {{ value: T }}
 */
export function source(initial) {
    const signal = $.source(initial);

    return {
        get value() {
            return $.get(signal);
        },
        set value(value) {
            $.set(signal, value);
        },
    };
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {{ value: T }}
 */
export function derived(fn) {
    const signal = $.derived(fn);

    return {
        get value() {
            return $.get(signal);
        },
    };
}

/**
 * @template T
 * @param {T} object
 * @returns {T}
 */
export function proxy(object) {
    return $.proxy(object);
}
