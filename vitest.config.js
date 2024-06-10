import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access } from "fs/promises";
import { basename, dirname } from "path";

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
            async transform(code, id, options) {
                if (id.endsWith(".twig")) {
                    const hasJS = await access(id.replace(/\.twig$/, ".js"))
                        .then(() => true)
                        .catch(() => false);

                    const result = compile(code, {
                        hasJS,
                        namespace: dirname(id),
                        filename: basename(id),
                        generate: "dom",
                    });

                    return result;
                }
            },
        },
    ],
});
