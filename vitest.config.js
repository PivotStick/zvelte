import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access, readFile, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { execSync } from "child_process";

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

                if (
                    id.endsWith(".zvelte") &&
                    id.startsWith(
                        join(root, "./src/__tests__/runtime-php-ssr/"),
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
                        params.get("props"),
                    );

                    return `export default ${JSON.stringify({
                        output,
                        code: result.code,
                    })};`;
                }

                if (id.endsWith(".twig")) {
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

                    return compile(code, options);
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
