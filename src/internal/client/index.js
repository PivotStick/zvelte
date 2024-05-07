/**
 * @template {Record<string, any>} [Props = Record<string, any>]
 * @template {Record<string, HTMLElement | undefined>} [BindedElements = Record<string, HTMLElement>]
 * @typedef {{
 *    props: Props;
 *    els: BindedElements;
 *    emit(type: string, detail?: any): void;
 * }} ComponentArgs
 */

export {
    mountComponent,
    onMount as _onMount,
    onDestroy as _onDestroy,
    setListeners as _setListeners,
    registerComponent,
    getComponentByKey,
} from "./astToDom.js";

export { registerFilter, getFilter } from "./filters.js";

export { mount, setListeners } from "./mount.js";
export { onMount, onDestroy } from "svelte";

export {
    proxy,
    source,
    derived,
    effect,
    ifBlock,
    forBlock,
    template,
} from "./reactivity.js";
