/**
 * @param {{
 *   props?: Record<string, any>;
 *   svelteOptions?: Parameters<import("svelte/compiler")["compile"]>[1];
 *   zvelteOptions?: Parameters<import("@pivotass/zvelte/compiler")["compile"]>[1];
 * }} options
 */
export default function conf(options) {
    return options;
}
