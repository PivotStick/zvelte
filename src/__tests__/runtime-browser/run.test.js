import { describe, expect, test } from "vitest";
import { proxy, tick } from "../../internal/client/index.js";
import { raf } from "../animation-helpers.js";
import samples from "./all.samples.js";

/**
 * @typedef {Array<{
 *  name: string;
 *  get(): Promise<{
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
            get: () => import(main),
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

            const component = await get();
            const props = proxy(config.props);

            component.mount({
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
