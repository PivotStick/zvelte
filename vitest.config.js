import { defineConfig } from "vitest/config";
import { compile } from "./src/compiler/index";
import { access } from "fs/promises";
import { basename, dirname } from "path";
import { parse } from "./src/compiler/phases/1-parse";

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

                    const options = {
                        hasJS,
                        namespace: dirname(id),
                        filename: basename(id),
                        generate: "dom",
                    };

                    const result = compile(code, options);

                    result.code += `

import * as $legacy from "@pivotass/zvelte";

export function legacy() {
    const ast = ${JSON.stringify(parse(code))};
    const component = $legacy.createComponent({
        ast,
    });

    return {
        default: component,
        mount: (args) => $.mount(component, args),
    }
}`;

                    return result;
                }
            },
        },
    ],
});
