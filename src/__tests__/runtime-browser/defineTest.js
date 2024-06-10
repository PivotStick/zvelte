/**
 * @template Props
 *
 * @param {{
 *  html?: string;
 *  props?: Props;
 *  test?: (args: { props: Props; target: HTMLElement }) => Promise<void> | void;
 * }} object
 */
export function defineTest(object) {
    return object;
}
