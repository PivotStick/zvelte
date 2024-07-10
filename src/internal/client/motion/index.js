import { onDestroy } from "svelte";
import * as $ from "svelte/motion";

/**
 * @template T
 *
 * @param {(v: T) => void} fn
 * @param {T} value
 * @param {$.TweenedOptions<T>} opts
 */
export function tweened(fn, value, opts) {
    const store = $.tweened(value, opts);
    const unsubscribe = store.subscribe((value) => fn(value));
    onDestroy(unsubscribe);

    return store;
}

/**
 * @template T
 *
 * @param {(v: T) => void} fn
 * @param {T} value
 * @param {$.SpringOpts} opts
 */
export function spring(fn, value, opts) {
    const store = $.spring(value, opts);
    const unsubscribe = store.subscribe((value) => fn(value));
    onDestroy(unsubscribe);

    return store;
}
