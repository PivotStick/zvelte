import { user_effect, user_pre_effect } from "svelte/internal/client";

export {
    ComponentInitArgs as Args,
    ComponentInitAsyncArgs as AsyncArgs,
} from "./types.d.ts";

export { getComponentByKey } from "./runtime/components.js";
export { registerFilter, getFilter } from "./runtime/filters.js";
export { mount, createComponent, contextualizeComponent } from "./dom/mount.js";
export { onMount, onDestroy, setContext, getContext, tick } from "svelte";

export function source<T>(initial: T): { value: T };
export function derived<T, K extends keyof T>(
    props: T,
    key: K,
    fn: () => T[K],
): void;
export function proxy<T>(object: T): T;
export function is(a: any, b: any): boolean;

export function effect(fn: () => void | (() => void)): void;

effect.pre = (fn: () => void | (() => void)) => {};
effect.root = (fn: () => void | (() => void)) => {};
effect.tracking = () => true;
