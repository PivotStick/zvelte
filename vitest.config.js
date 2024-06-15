import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access } from "fs/promises";
import { basename, dirname, join } from "path";
import { parse } from "./src/compiler/phases/1-parse";
import { walk } from "zimmerframe";

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

                if (id.endsWith(".twig")) {
                    const params = new URLSearchParams(query);

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

                        const output = `
import { createComponent } from "@pivotass/zvelte";
${[...imports].join("\n")}

export const mount = createComponent({
    ast: ${JSON.stringify(ast)},
    key: "${key}",
    init: ${hasJS} ? js.default : undefined,
    initScope: ${hasJS} ? js.scope : undefined,
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
