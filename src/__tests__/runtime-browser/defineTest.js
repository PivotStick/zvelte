/**
 * @template Props
 *
 * @param {{
 *  html?: string;
 *  props?: Props;
 *  todo?: boolean;
 *  only?: boolean;
 *  fails?: boolean;
 *  test?: (args: { props: Props; target: HTMLElement; raf: typeof import("../animation-helpers.js")["raf"] }) => Promise<void> | void;
 *  before?: () => void;
 *  after?: () => void;
 *  compilerOptions?: Partial<import("../../compiler/types.js").CompilerOptions>;
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

export function wait(ms = 1000) {
    return new Promise((res) => setTimeout(res, ms));
}
