/**
 * @template Props
 *
 * @param {{
 *  html?: string;
 *  props?: Props;
 *  todo?: boolean;
 *  only?: boolean;
 *  fails?: boolean;
 *  test?: (args: { props: Record<keyof Props, any>; target: HTMLElement; raf: typeof import("../animation-helpers.js")["raf"] }) => Promise<void> | void;
 *  before?: () => void;
 * }} object
 */
export function defineTest(object) {
    return object;
}

/**
 * @template T
 * @param {T} value
 * @returns {asserts value}
 */
export function ok(value) {
    if (!value) throw new Error(`Expected truthy value but got ${value}`);
}
