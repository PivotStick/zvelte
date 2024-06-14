/**
 * @template Props
 *
 * @param {{
 *  html?: string;
 *  props?: Props;
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
