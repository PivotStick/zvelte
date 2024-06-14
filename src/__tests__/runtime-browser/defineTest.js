/**
 * @template Props
 *
 * @param {{
 *  html?: string;
 *  props?: Props;
 *  legacyProps?: Props;
 *  todo?: boolean;
 *  only?: boolean;
 *  fails?: boolean;
 *  test?: (args: { props: Props; target: HTMLElement }) => Promise<void> | void;
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
