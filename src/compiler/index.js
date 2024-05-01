import { parse } from "./parse/index.js";
import { renderDom } from "./compile/render_dom/index.js";
import { renderPhpSSR } from "./compile/render_php_ssr/index.js";

const renderers = {
    dom: renderDom,
    php_ssr: renderPhpSSR,
};

/**
 * @param {string} source
 * @param {{
 *  generate?: keyof renderers;
 *  hydratable?: boolean;
 * }} [options]
 * @param {{ js?: string }} [meta]
 */
export function compile(source, options = {}, meta = {}) {
    const ast = parse(source);

    options.generate = options.generate ?? "dom";
    options.hydratable = options.hydratable ?? false;

    const render = renderers[options.generate];

    if (!render) throw new Error(`"${options.generate}" renderer not found`);

    return render(ast, options, meta);
}
