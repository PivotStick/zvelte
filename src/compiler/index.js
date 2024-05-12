import { parse } from "./phases/1-parse/index.js";
import { renderDom, renderPhpSSR } from "./phases/3-transfom/index.js";

const renderers = {
    dom: renderDom,
    php_ssr: renderPhpSSR,
};

/**
 * @param {string} source
 * @param {{
 *  dir: string;
 *  filename: string;
 *  namespace: string;
 *  generate?: keyof renderers;
 *  parser?: Parameters<typeof parse>[1];
 *  hydratable?: boolean;
 * }} options
 * @param {{ js?: string }} [meta]
 */
export function compile(source, options, meta = {}) {
    const ast = parse(source, options.parser);

    options.generate = options.generate ?? "dom";
    options.hydratable = options.hydratable ?? false;

    const render = renderers[options.generate];

    if (!render) throw new Error(`"${options.generate}" renderer not found`);

    return render(ast, options, meta);
}

export { hash } from "./utils/hash.js";
