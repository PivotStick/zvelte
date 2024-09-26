import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-expect-error
import Foo from "./Foo.zvelte";
// @ts-expect-error
import Bar from "./Bar.zvelte";

export default defineTest({
    get props() {
        return {
            x: Foo,
        };
    },

    html: "<!----><!----><p>Foo</p>",

    async test({ props, target }) {
        props.x = Bar;
        await tick();

        expect(target.innerHTML).toEqual("<!----><!----><p>Bar</p>");
    },
});
