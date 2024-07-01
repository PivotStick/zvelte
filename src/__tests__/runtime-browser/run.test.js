import { describe, expect, test } from "vitest";
import { proxy } from "../../internal/client/index.js";
import { raf } from "../animation-helpers.js";
import samples from "./all.samples.js";

/**
 * @typedef {Array<{
 *  name: string;
 *  get(options: any): Promise<{
 *      mount: any;
 *      default: any;
 *  }>;
 *  config: ReturnType<typeof import("./defineTest.js")["defineTest"]>
 * }>} Tests
 */

/**
 * @param {typeof samples[keyof typeof samples]} samples
 */
async function toTests(samples) {
    /** @type {Tests} */
    const tests = [];

    for (const { _config, main } of samples) {
        const name = _config.split("/").at(-2) ?? "";
        const module = await import(_config);

        tests.push({
            name,
            get: (options) => {
                const search = new URLSearchParams(options ?? {});
                const separator = main.endsWith("?legacy=true") ? "&" : "?";
                return import(main + separator + search);
            },
            config: module.default,
        });
    }

    return tests;
}

/**
 * @param {Tests} tests
 */
function run(tests) {
    for (const { name, config, get } of tests) {
        const target = document.body;
        const exec = async () => {
            config.before?.();

            target.innerHTML = "";
            raf.reset();
            for (const style of document.styleSheets) {
                if (style.ownerNode) {
                    style.ownerNode.remove();
                }
            }

            const payload = {};

            if (config.compilerOptions) {
                payload.options = btoa(JSON.stringify(config.compilerOptions));
            }

            const component = await get(payload);
            const props = proxy(config.props ?? {});

            const ref = component.mount({
                target,
                props,
            });

            if (typeof config.html === "string") {
                expect(target.innerHTML).toEqual(config.html);
            }

            await config.test?.({
                props,
                target,
                raf,
            });

            ref?.destroy?.();
            config.after?.();
        };

        if (config.todo) test.todo(name, exec);
        else if (config.only) test.only(name, exec);
        else if (config.fails) test.fails(name, exec);
        else test(name, exec);
    }
}

const legacy = await toTests(samples.legacy);
const modern = await toTests(samples.modern);

describe("runtime-legacy-browser", () => run(legacy));
describe("runtime-browser", () => run(modern));
