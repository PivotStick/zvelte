/**
 * @template T
 * @typedef {import("./types.js").ComponentInit<T>} ComponentInit
 */

export { registerFilter, getFilter } from "./filters.js";

export { mount } from "./mount.js";
export { onMount, onDestroy, tick } from "svelte";
export {
    source,
    proxy,
    user_effect as effect,
    derived,
} from "svelte/internal/client";

export { template } from "./reactivity.js";
