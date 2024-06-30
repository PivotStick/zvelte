/**
 * @template Props
 *
 * @param {{
 *  html: string;
 *  props?: Props;
 *  todo?: boolean;
 *  only?: boolean;
 *  fails?: boolean;
 *  before?: () => void;
 *  after?: () => void;
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
