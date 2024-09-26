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
            Foo,
            Bar,
            x: true,
        };
    },

    html: "<!----><p>true, therefore Foo</p>",

    async test({ props, target }) {
        props.x = false;
        await tick();

        expect(target.innerHTML).toEqual("<!----><p>false, therefore Bar</p>");
    },
});
