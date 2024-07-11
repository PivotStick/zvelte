export { getComponentByKey } from "./runtime/components.js";
export { registerFilter, getFilter } from "./runtime/filters.js";
export { mount, createComponent, contextualizeComponent } from "./dom/mount.js";
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
 * @template {keyof T} K
 *
 * @param {T} props
 * @param {K} key
 * @param {() => T[K]} fn
 */
export function derived(props, key, fn) {
    const signal = $.derived(fn);

    Object.defineProperty(props, key, {
        get() {
            return $.get(signal);
        },
    });
}

/**
 * @template T
 * @param {T} object
 * @returns {T}
 */
export function proxy(object) {
    return $.proxy(object);
}

/**
 * @param {*} a
 * @param {*} b
 */
export function is(a, b) {
    return $.is(a, b);
}
