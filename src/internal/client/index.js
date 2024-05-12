/**
 * @template T
 * @typedef {import("./types.js").ComponentInitArgs<T>} ComponentInitArgs
 */

export { getComponentByKey } from "./runtime/components.js";

export { registerFilter, getFilter } from "./runtime/filters.js";

export { mount, createComponent } from "./dom/mount.js";
export { onMount, onDestroy, tick } from "svelte";
export {
    source,
    proxy,
    user_effect as effect,
    derived,
} from "svelte/internal/client";
