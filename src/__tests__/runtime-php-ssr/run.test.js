import { describe, expect, test } from "vitest";

/**
 * @type {Record<string, () => Promise<{ default: ReturnType<typeof import("./defineTest.js")["defineTest"]>}>>}
 */
// @ts-ignore
const paths = import.meta.glob("./samples/**/_config.js");

/**
 * @type {{
 *  name: string;
 *  config: ReturnType<typeof import("./defineTest.js")["defineTest"]>
 *  component: { render(props?: any): Promise<{ output: string; code: string; }>; }
 * }[]}
 */
const tests = [];

for (const path in paths) {
    const module = await paths[path]();

    tests.push({
        name: path.split("/").at(-2) ?? "??",
        config: module.default,
        component: {
            render: async (props) =>
                (
                    await import(
                        path.replace(/_config\.js$/, "main.zvelte") +
                            `?props=${btoa(JSON.stringify(props))}`
                    )
                ).default,
        },
    });
}

describe("runtime-php-ssr", () => {
    for (const { name, config, component } of tests) {
        if (config.before) config.before();

        const exec = async () => {
            const { output, code } = await component.render(config.props ?? {});
            try {
                expect(config.html).toEqual(output);
            } catch (error) {
                console.log(code);
                throw error;
            }
        };

        if (config.only) test.only(name, exec);
        else if (config.todo) test.todo(name, exec);
        else if (config.fails) test.fails(name, exec);
        else test(name, exec);

        if (config.after) config.after();
    }
});
