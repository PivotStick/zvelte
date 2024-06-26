import { walk } from "zimmerframe";
import { parse } from "./phases/1-parse/index.js";
import { analyseComponent } from "./phases/2-analyze/index.js";
import { renderStylesheet } from "./phases/3-transform/css/index.js";
import { renderDom, renderPhpSSR } from "./phases/3-transform/index.js";

const renderers = {
    dom: renderDom,
    php_ssr: renderPhpSSR,
};

/**
 * @param {string} source
 * @param {({
 *  generate?: keyof renderers;
 *  parser?: Parameters<typeof parse>[1];
 *  hydratable?: boolean;
 *  dev?: boolean;
 * } & Partial<import("./types.js").CompilerOptions>)=} options
 * @param {{ js?: string }} [meta]
 */
export function compile(source, options = {}, meta = {}) {
    const ast = parse(source, options.parser);

    if (options.transformers?.ast) {
        walk(ast, {}, options.transformers.ast);
    }

    options.generate = options.generate ?? "dom";
    options.hydratable = options.hydratable ?? false;
    options.dev ??= false;
    options.namespace ??= "Zvelte\\Components";
    options.internalsNamespace ??= "Zvelte\\Core";
    options.filename ??= "Component.twig";
    options.hasJS ??= false;

    const render = renderers[options.generate];

    if (!render) throw new Error(`"${options.generate}" renderer not found`);

    const analysis = analyseComponent(ast);

    if (analysis.css) {
        renderStylesheet(source, analysis, {
            filename: options.filename,
            dev: options.dev,
        });
    }

    return render(
        ast,
        analysis,
        {
            dir: options.dir ?? "",
            namespace: options.namespace,
            internalsNamespace: options.internalsNamespace,
            filename: options.filename,
            hasJS: options.hasJS,
            async: options.async,
            preserveWhitespace: false,
            preserveComments: true,
        },
        meta
    );
}

export { hash } from "./utils/hash.js";
export { walk } from "zimmerframe";
