import { onDestroy } from "svelte";
import * as $ from "svelte/motion";
import { source, get, set } from "svelte/internal/client";

/**
 * @template T
 * @template {keyof T} K
 *
 * @param {T} props
 * @param {K} key
 * @param {T[K]} value
 * @param {$.TweenedOptions<T[K]>=} opts
 */
export function tweened(props, key, value, opts) {
    const store = $.tweened(value, opts);
    const signal = source(value);

    Object.defineProperty(props, key, {
        get() {
            return get(signal);
        },
        set(value) {
            store.set(value);
        },
    });

    const unsubscribe = store.subscribe((value) => set(signal, value));

    onDestroy(unsubscribe);

    return store;
}

/**
 * @template T
 * @template {keyof T} K
 *
 * @param {T} props
 * @param {K} key
 * @param {T[K]} value
 * @param {$.SpringOpts=} opts
 */
export function spring(props, key, value, opts) {
    const store = $.spring(value, opts);
    const signal = source(value);

    Object.defineProperty(props, key, {
        get() {
            return get(signal);
        },

        set(value) {
            store.set(value);
        },
    });

    const unsubscribe = store.subscribe((value) => set(signal, value));

    onDestroy(unsubscribe);

    return store;
}
