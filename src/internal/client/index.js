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
    onMount,
    onDestroy,
    setListeners,
    registerComponent,
    getComponentByKey,
} from "./astToDom.js";

export { registerFilter } from "./filters.js";

export {
    proxy,
    source,
    derived,
    effect,
    ifBlock,
    forBlock,
    template,
} from "./reactivity.js";
