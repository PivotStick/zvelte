import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access, readFile, readdir, rm, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { parse } from "./src/compiler/phases/1-parse";
import { walk } from "zimmerframe";
import * as acorn from "acorn";
import { print } from "esrap";
import { execSync } from "child_process";

let root = "";
const safe = (str) => `\`${str.replace(/`/g, "\\`")}\``;

export default defineConfig({
    test: {
        browser: {
            enabled: true,
            name: "chrome",
            headless: true,
        },
        coverage: {
            enabled: true,
            provider: "istanbul",
        },
    },
    plugins: [
        {
            name: "zvelte-vite-plugin",
            configResolved(config) {
                root = config.root;
            },
            async transform(code, id, options) {
                let query = "";
                [id, query] = id.split("?");
                const params = new URLSearchParams(query);

                if (
                    id.endsWith(".zvelte") &&
                    id.startsWith(
                        join(root, "./src/__tests__/runtime-php-ssr/")
                    )
                ) {
                    const optionsPath = id.replace(/\.zvelte$/, ".json");
                    const hasOptions = await access(optionsPath)
                        .then(() => true)
                        .catch(() => false);

                    const options = hasOptions
                        ? JSON.parse(await readFile(optionsPath, "utf8"))
                        : {};

                    const result = compile(code, {
                        ...options,
                        generate: "php_ssr",
                    });

                    const output = await runPHP(
                        result.code,
                        params.get("props")
                    );

                    return `export default ${JSON.stringify({
                        output,
                        code: result.code,
                    })};`;
                }

                if (id.endsWith("all.samples.js")) {
                    const legacy = [];
                    const modern = [];

                    async function glob(dir = "") {
                        for (const entry of await readdir(dir, {
                            withFileTypes: true,
                        })) {
                            if (entry.isFile() && entry.name === "_config.js") {
                                legacy.push({
                                    _config: join(
                                        dir,
                                        "_config.js?legacy=true"
                                    ),
                                    main: join(dir, "main.twig?legacy=true"),
                                });

                                modern.push({
                                    _config: join(dir, "_config.js"),
                                    main: join(dir, "main.twig"),
                                });
                            } else if (entry.isDirectory()) {
                                await glob(join(dir, entry.name));
                            }
                        }
                    }

                    await glob(join(dirname(id), "samples"));

                    return `
export default {
    legacy: ${JSON.stringify(legacy)},
    modern: ${JSON.stringify(modern)},
};
`.trim();
                }

                if (id.endsWith(".js") && params.get("legacy") === "true") {
                    const ast = acorn.parse(code, {
                        ecmaVersion: 2023,
                        sourceType: "module",
                    });

                    walk(
                        /** @type {import("estree").Node} */ (ast),
                        {},
                        {
                            ImportDeclaration(node) {
                                if (
                                    typeof node.source.value === "string" &&
                                    (node.source.value.endsWith(".twig") ||
                                        node.source.value.endsWith(".js"))
                                ) {
                                    node.source.value += "?legacy=true";
                                    node.source.raw = `"${node.source.value}"`;
                                }
                            },
                        }
                    );

                    return print(ast);
                }

                if (id.endsWith(".twig")) {
                    let search = query ? "?" + query : "";
                    const hasJS = await access(id.replace(/\.twig$/, ".js"))
                        .then(() => true)
                        .catch(() => false);

                    let overrides = {};

                    if (params.has("options")) {
                        const base64 = /** @type {string} */ (
                            params.get("options")
                        );
                        const json = atob(base64);
                        overrides = JSON.parse(json);
                    }

                    /** @type {import("./src/compiler/types").CompilerOptions} */
                    const options = {
                        hasJS,
                        namespace: dirname(id),
                        filename: basename(id),
                        generate: "dom",
                        ...overrides,
                    };

                    const imports = new Set([]);
                    const ast = parse(code);

                    walk(
                        /** @type {import("./src/compiler/phases/1-parse/types").ZvelteNode} */ (
                            ast
                        ),
                        {},
                        {
                            Component(node, { next }) {
                                const key = join(
                                    dirname(id),
                                    node.key.data
                                ).replace(root, "");

                                imports.add(
                                    `import "${node.key.data}${search}";`
                                );
                                node.key.data = key;
                                next();
                            },
                        }
                    );

                    if (params.get("legacy") === "true") {
                        const key = id.replace(root, "");

                        if (hasJS) {
                            imports.add(
                                `import * as js from "./${basename(id).replace(
                                    ".twig",
                                    ".js" + search
                                )}";`
                            );
                        }

                        let output = `
import { createComponent } from "@pivotass/zvelte";
${[...imports].join("\n")}

export const mount = createComponent({
    ast: ${JSON.stringify(ast)},
    key: "${key}",
    init: ${hasJS ? "js.default" : "undefined"},
    initScope: ${hasJS ? "js.scope" : "undefined"},
    options: ${JSON.stringify(options)}
});

export default mount.component;
`;

                        return output;
                    } else {
                        const result = compile(code, options);

                        if (imports.size) {
                            result.code = `${[...imports].join("\n")}\n${
                                result.code
                            }`;
                        }

                        return result;
                    }
                }
            },
        },
    ],
});

/**
 * @param {string} code
 */
async function runPHP(code, props) {
    const dir = "./src/__tests__/runtime-php-ssr/php";
    const path = join(dir, "/current.php");
    await writeFile(path, code);
    const buffer = execSync(`cd ${dir} && php index.php '${props}'`);
    return buffer.toString();
}
