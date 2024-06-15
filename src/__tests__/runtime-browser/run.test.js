import { describe, expect, test } from "vitest";
import { proxy, tick } from "../../internal/client/index.js";
import { raf } from "../animation-helpers.js";

// @ts-ignore
const modulePaths = await import.meta.glob("./samples/**/_config.js");

/**
 * @type {Array<{
 *  name: string;
 *  get(): Promise<{
 *      mount: any;
 *      default: any;
 *  }>;
 *  config: ReturnType<typeof import("./defineTest.js")["defineTest"]>
 * }>}
 */
const tests = [];

/**
 * @type {typeof tests}
 */
const legacyTests = [];

for (const path in modulePaths) {
    /** @type {string} */
    // @ts-ignore
    const name = path.split("/").at(-2);
    // @ts-ignore
    const module = await modulePaths[path]();

    /**
     * @param {*} o
     */
    function payload(o) {
        const params = new URLSearchParams(o);
        return params.size ? "?" + params : "";
    }

    const main = path.replace(/[^/]+$/, "main.twig");

    tests.push({
        name,
        get: () => import(main + payload({})),
        config: module.default,
    });

    legacyTests.push({
        name,
        get: () => import(main + payload({ legacy: true })),
        config: module.default,
    });
}

/**
 * @param {typeof tests} tests
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

describe("runtime-legacy-browser", () => run(legacyTests));
describe("runtime-browser", () => run(tests));
