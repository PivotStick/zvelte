import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-ignore
import Foo from "./Foo.zvelte";
// @ts-ignore
import Bar from "./Bar.zvelte";

export default defineTest({
    get props() {
        return {
            Foo,
            Bar,
            x: 0,
        };
    },

    html: "<!----><p>Bar 0</p>",

    async test({ props, target }) {
        props.x = 1;
        await tick();

        expect(target.innerHTML).toEqual("<!----><p>Foo 1</p>");
    },
});
