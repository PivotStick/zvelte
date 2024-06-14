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

                    const imports = new Set([
                        `import * as $legacy from "@pivotass/zvelte";`,
                        `import "@pivotass/zvelte/compiler";`,
                    ]);

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

                                imports.add(`import "${node.key.data}";`);
                                node.key.data = key;
                                next();
                            },
                        }
                    );

                    const result = compile(code, options);
                    const key = id.replace(root, "");

                    result.code += `

${[...imports].join("\n")}

const legacyMount = $legacy.createComponent({
    ast: ${JSON.stringify(ast)},
    key: "${key}",
    init: ${hasJS} ? js.default : undefined,
    initScope: ${hasJS} ? js.scope : undefined,
});

export const legacy = {
    default: legacyMount.component,
    mount: legacyMount,
}`;

                    return result;
                }
            },
        },
    ],
});
