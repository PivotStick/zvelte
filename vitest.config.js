import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access, readdir } from "fs/promises";
import { basename, dirname, join } from "path";
import { parse } from "./src/compiler/phases/1-parse";
import { walk } from "zimmerframe";
import * as acorn from "acorn";
import { print } from "esrap";

let root = "";

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

                if (id.endsWith("/_config.js")) {
                    const ast = acorn.parse(code, {
                        ecmaVersion: 2020,
                        sourceType: "module",
                    });

                    if (params.get("legacy") === "true") {
                        walk(
                            /** @type {import("estree").Node} */ (ast),
                            {},
                            {
                                ImportDeclaration(node) {
                                    if (
                                        typeof node.source.value === "string" &&
                                        node.source.value.endsWith(".twig")
                                    ) {
                                        node.source.value += "?legacy=true";
                                        node.source.raw = `"${node.source.value}"`;
                                    }
                                },
                            }
                        );
                    }

                    return print(ast);
                }

                if (id.endsWith(".twig")) {
                    const hasJS = await access(id.replace(/\.twig$/, ".js"))
                        .then(() => true)
                        .catch(() => false);

                    const options = {
                        hasJS,
                        namespace: dirname(id),
                        filename: basename(id),
                        generate: "dom",
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
                                    `import "${node.key.data}${
                                        query ? `?${query}` : ""
                                    }";`
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
                                    ".js"
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
});

export default mount.component;
`;

                        output += `\nexport const legacy = \`${output
                            .replace(/`/g, "\\`")
                            .replace(/\$\{/g, "\\${")}\`;`;

                        return output;
                    } else {
                        const result = compile(code, options);

                        if (imports.size) {
                            result.code = `${[...imports].join("\n")}\n${
                                result.code
                            }`;
                        }

                        result.code += `\nexport const legacy = \`${result.code
                            .replace(/`/g, "\\`")
                            .replace(/\$\{/g, "\\${")}\`;`;

                        return result;
                    }
                }
            },
        },
    ],
});
