import { expect, test } from "vitest";

/**
 * @type {Record<string, () => Promise<any>>}
 */
// @ts-ignore
const samples = await import.meta.glob("./samples/**/_config.js");

const options = (/** @type {any} */ o) =>
    new URLSearchParams({
        options: btoa(JSON.stringify(o)),
    });

for (const key in samples) {
    if (samples.hasOwnProperty(key)) {
        /**
         * @type {{ default: ReturnType<typeof import("./conf.js")["default"]>}}
         */
        const { default: config } = await samples[key]();

        const zvelteOptions = options({
            preserveComments: false,
            ...(config.zvelteOptions ?? {}),
            generate: "php_ssr",
        });
        const { default: zvelte } = await import(
            key.replace(/_config\.js$/, "main.zvelte?" + zvelteOptions)
        );

        const svelteOptions = options({
            preserveComments: false,
            ...(config.svelteOptions ?? {}),
            generate: "server",
        });
        const { default: svelte } = await import(
            key.replace(/_config\.js$/, "main.svelte?" + svelteOptions)
        );

        const sveltePayload = {
            out: "",
            head: { out: "", title: "" },
        };

        const zveltePayload = {
            out: "",
            head: { out: "", title: "" },
        };

        const name = key.match(/\/([^/]+)\/[^/]+$/)?.[1];

        if (!name) throw new Error("Test name not found");

        test(name, async () => {
            svelte(sveltePayload, config.props ?? {});
            await zvelte(zveltePayload, config.props ?? {});

            expect(zveltePayload).toEqual(sveltePayload);
        });
    }
}
