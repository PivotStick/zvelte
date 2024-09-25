import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { execSync } from "child_process";

import * as svelte from "svelte/compiler";

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
            async transform(code, id) {
                let query = "";
                [id, query] = id.split("?");
                const params = new URLSearchParams(query);

                if (!id.endsWith(".zvelte")) return;

                const hasJS = await access(id.replace(/\.zvelte$/, ".js"))
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
                    namespace: dirname(id)
                        .replace(root, "")
                        .replace(
                            "/src/__tests__/svelte-ssr-match",
                            "Zvelte/Components",
                        )
                        .replace(/\//g, "\\"),
                    filename: basename(id),
                    generate: "dom",
                    preserveComments: true,
                    ...overrides,
                };

                const output = compile(code, options);

                if (options.generate === "php_ssr") {
                    const path = id
                        .replace(
                            "/src/__tests__/svelte-ssr-match",
                            "/src/__tests__/php/components",
                        )
                        .replace(/\.zvelte$/, ".php");

                    await mkdir(dirname(path), { recursive: true });
                    await writeFile(path, output.code);

                    const endpoint = path.replace(
                        join(root, "src/__tests__/php/components"),
                        "",
                    );

                    return `export default async function(payload, props) {
    const result = await fetch("${endpoint}", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(props),
    }).then(res => res.json());

    payload.out = result.out;
    payload.head.out = result.head.out;
    payload.head.title = result.head.title;
}`;
                }

                return output.code;
            },
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (
                        req.method === "POST" &&
                        req.url.endsWith(".php") &&
                        req.headers["content-type"] === "application/json"
                    ) {
                        let body = "";

                        req.on("data", (chunk) => (body += chunk));
                        req.on("end", () => {
                            const props = btoa(body);
                            const path =
                                `Zvelte/Components${req.url.replace(".php", "")}`.replace(
                                    /\//g,
                                    "\\",
                                );

                            const buffer = execSync(
                                `cd ./src/__tests__/php/ && php render.php '${path}' '${props}'`,
                            );

                            res.setHeader("content-type", "application/json");
                            res.end(buffer);
                        });

                        return;
                    }

                    next();
                });
            },
        },
        {
            name: "svelte-vite-plugin",
            async transform(code, id) {
                let query = "";
                [id, query] = id.split("?");
                const params = new URLSearchParams(query);

                if (!id.endsWith(".svelte")) return;

                let overrides = {};

                if (params.has("options")) {
                    const base64 = /** @type {string} */ (
                        params.get("options")
                    );
                    const json = atob(base64);
                    overrides = JSON.parse(json);
                }

                code = code.replace(
                    /\/(\w+)\.svelte"/g,
                    `/$1.svelte?${query}"`,
                );

                const result = svelte.compile(code, {
                    generate: "client",
                    filename: basename(id),
                    runes: true,
                    preserveComments: true,
                    ...overrides,
                });

                return result.js;
            },
        },
    ],
});
