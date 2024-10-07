export { registerFilter, getFilter } from "./runtime/filters.js";
export { onMount, onDestroy, setContext, getContext, tick } from "svelte";
import * as $ from "svelte/internal/client";

/**
 * @param {Parameters<typeof $.user_effect>[0]} fn
 */
export function effect(fn) {
    return $.user_effect(fn);
}

effect.pre = $.user_pre_effect;
effect.root = $.effect_root;
effect.tracking = $.effect_tracking;

/**
 * @template T
 * @template {keyof T} K
 *
 * @param {T} scope
 * @param {K} key
 * @param {T[K]} initial
 */
export function state(scope, key, initial) {
    const signal = $.state(initial);

    Object.defineProperty(scope, key, {
        get() {
            return $.get(signal);
        },
        set(value) {
            return $.set(signal, value);
        },
    });
}

/**
 * @template T
 * @template {keyof T} K
 *
 * @param {T} scope
 * @param {K} key
 * @param {() => T[K]} fn
 */
export function derived(scope, key, fn) {
    const signal = $.derived(fn);

    Object.defineProperty(scope, key, {
        enumerable: true,
        configurable: true,
        get() {
            return $.get(signal);
        },
    });
}

export const proxy = $.proxy;
