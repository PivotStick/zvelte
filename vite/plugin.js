import { compile } from "../src/compiler/index.js";
import { existsSync } from "fs";
import * as path from "path";
import { readFile } from "fs/promises";

/**
 * @param {{
 *  compilerOptions?: import('../types/index.js').CompilerOptions
 * }=} options
 *
 * @returns {import("vite").Plugin}
 */
export const zone = async (options = {}) => {
    options.compilerOptions = options.compilerOptions ?? {};

    /**
     * @type {import('vite').UserConfig}
     */
    let config;
    let jsconfig;

    return {
        name: "vite-plugin-zone",

        async resolveId(source, importer, options) {
            const paths = jsconfig?.compilerOptions?.paths?.[source];
            if (paths) {
                return path.join(config.root, paths[0]);
            }
        },

        async configResolved(c) {
            config = c;
            const jsconfigPath = path.join(config.root, "jsconfig.json");
            jsconfig = JSON.parse(await readFile(jsconfigPath, "utf8"));
        },

        transform(code, id, o) {
            if (id.endsWith(".twig")) {
                const jsPath = id.replace(/twig$/, "js");

                /**
                 * @type {import('../types/index.js').CompilerOptions}
                 */
                const compilerOptions = {
                    ...options.compilerOptions,
                    // generate: o.ssr ? 'php_ssr' : 'dom',
                    // hydratable: true,
                };

                const meta = {
                    js: existsSync(jsPath)
                        ? `./${path.basename(jsPath)}`
                        : null,
                };

                const results = compile(code, compilerOptions, meta);
                if (o.ssr) {
                    console.log(results.code);
                }
                return results;
            }
        },

        configureServer(server) {
            return;
            server.middlewares.use(async (req, res, next) => {
                if (req.url === "/") {
                    const ctx = {
                        props: {},
                    };

                    const template = await readFile("src/app.html", "utf8");
                    const body = `<script>{
                        const target = document.currentScript.parentElement;
                        const props = ${JSON.stringify(ctx.props)};
                        const config = ${JSON.stringify({ hydrate: false })};

                        Promise.all([
                            import("/@vite/client"),
                            import("/.zone/client/start.js")
                        ]).then(([, { start }]) => {
                            start(target, props, config);
                        })
                    }</script>`;
                    res.end(
                        template
                            .replace(/%zvelte\.body%/, body)
                            .replace(/%zvelte\.head%/, ""),
                    );
                    return;
                }
                next();
            });
        },
    };
};
