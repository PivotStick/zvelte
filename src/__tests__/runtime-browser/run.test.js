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

for (const path in modulePaths) {
    /** @type {string} */
    // @ts-ignore
    const name = path.split("/").at(-2);
    // @ts-ignore
    const module = await modulePaths[path]();
    tests.push({
        name,
        component: module.component,
        config: module.default,
    });
}

describe("Will test runtime-browser", () => {
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
});
