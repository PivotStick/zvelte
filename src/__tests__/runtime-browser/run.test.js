import { describe, expect, test } from "vitest";
import { proxy } from "../../internal/client/index.js";

// @ts-ignore
const modulePaths = await import.meta.glob("./samples/**/_config.js");

/**
 * @type {Array<{
 *  name: string;
 *  component: {
 *      mount: any;
 *      default: any;
 *  };
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
    const component = await import(path.replace(/[^/]+$/, "main.twig"));

    tests.push({
        name,
        component: {
            mount: component.mount,
            default: component.default,
        },
        config: module.default,
    });

    legacyTests.push({
        name,
        component: component.legacy(),
        config: module.default,
    });
}

/**
 * @param {typeof tests} tests
 */
function run(tests) {
    for (const { name, config, component } of tests) {
        test(name, async () => {
            document.body.innerHTML = "";

            const props = proxy(config.props);

            component.mount({
                target: document.body,
                props,
            });

            if (config.html) {
                expect(document.body.innerHTML).toBe(config.html);
            }

            await config.test?.({
                props,
                target: document.body,
            });
        });
    }
}

describe("runtime-browser", () => run(tests));
describe("runtime-legacy-browser", () => run(tests));
