import { walk } from "zimmerframe";
import { parse } from "./phases/1-parse/index.js";
import { analyseComponent } from "./phases/2-analyze/index.js";
import { renderStylesheet } from "./phases/3-transform/css/index.js";
import { renderDom, renderPhpSSR } from "./phases/3-transform/index.js";
import { compileString } from "sass";

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
    source = preprocess(source);
    const ast = parse(source, options.parser);

    if (options.transformers?.ast) {
        walk(ast, {}, options.transformers.ast);
    }

    options.generate = options.generate ?? "dom";
    options.hydratable = options.hydratable ?? false;
    options.dev ??= false;
    options.css ??= "injected";
    options.namespace ??= "Zvelte\\Components";
    options.internalsNamespace ??= "Zvelte\\Core";
    options.filename ??= "Component.zvelte";
    options.hasJS ??= false;
    options.preserveWhitespace ??= false;
    options.preserveComments ??= false;

    const render = renderers[options.generate];

    if (!render) throw new Error(`"${options.generate}" renderer not found`);

    const compilerOptions = {
        dir: options.dir ?? "",
        namespace: options.namespace,
        internalsNamespace: options.internalsNamespace,
        filename: options.filename,
        hasJS: options.hasJS,
        generate: options.generate,
        async: options.async,
        preserveWhitespace: options.preserveWhitespace,
        preserveComments: options.preserveComments,
        css: options.css,
        dev: options.dev,
    };

    const analysis = analyseComponent(ast, compilerOptions);

    if (analysis.css && options.css === "external") {
        analysis.css.generated = renderStylesheet(
            source,
            analysis,
            compilerOptions,
        );
    }

    const out = render(source, ast, analysis, compilerOptions, meta);

    return {
        code: out.code,
        css: analysis.css?.generated,
    };
}

export { hash } from "./utils/hash.js";
export { walk } from "zimmerframe";

/**
 * @param {string} template
 * @returns {string}
 */
function preprocess(template) {
    template = template.replace(
        /<style\s+lang\s*=\s*["'](scss|sass)["']\s*>([\s\S]*)<\/\s*style\s*>/,
        (_, lang, code) => {
            return `<style lang="${lang}">${compileString(code).css}</style>`;
        },
    );

    return template;
}
