export {
    ComponentInitArgs as Args,
    ComponentInitAsyncArgs as AsyncArgs,
} from "./types.d.ts";

export { getComponentByKey } from "./runtime/components.js";
export { registerFilter, getFilter } from "./runtime/filters.js";
export { mount, createComponent, contextualizeComponent } from "./dom/mount.js";
export { onMount, onDestroy, tick } from "svelte";
export { user_effect as effect } from "svelte/internal/client";

export function source<T>(initial: T): { value: T };
export function derived<T>(fn: () => T): { readonly value: T };
export function proxy<T>(object: T): T;
export function is(a: any, b: any): boolean;
