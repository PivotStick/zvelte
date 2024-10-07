import { user_effect, user_pre_effect } from "svelte/internal/client";

export {
    ComponentInitArgs as Args,
    ComponentInitAsyncArgs as AsyncArgs,
} from "./types.d.ts";

export { registerFilter, getFilter } from "./runtime/filters.js";
export { onMount, onDestroy, setContext, getContext, tick } from "svelte";

export function state<T, K extends keyof T>(
    scope: T,
    key: K,
    initial: T[K],
): void;

export function derived<T, K extends keyof T>(
    scope: T,
    key: K,
    fn: () => T[K],
): void;

export function proxy<T>(object: T): T;

export function effect(fn: () => void | (() => void)): void;

effect.pre = (fn: () => void | (() => void)) => {};
effect.root = (fn: () => void | (() => void)) => {};
effect.tracking = () => true;
