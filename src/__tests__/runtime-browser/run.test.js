import { describe, expect, test } from "vitest";
import { proxy } from "../../internal/client/index.js";
import { mount } from "../../internal/client/runtime/index.js";
import { raf } from "../animation-helpers.js";

/**
 * @type {Record<string, () => Promise<any>>}
 */
// @ts-ignore
const samples = await import.meta.glob("./samples/**/_config.js");

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
 * @param {typeof samples} samples
 */
async function toTests(samples) {
    /** @type {Tests} */
    const tests = [];

    for (const key in samples) {
        const module = await samples[key]();
        const name = key.split("/").at(-2) ?? "";
        const main = key.replace(/_config\.js$/, "main.twig");

        tests.push({
            name,
            get: (options) => {
                const search = new URLSearchParams(options ?? {});
                const separator = "?";
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

            const ref = mount(component.default, {
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

const modern = await toTests(samples);

describe("runtime-browser", () => run(modern));
