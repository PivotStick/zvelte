import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-expect-error
import * as Foo from "./Foo.twig";
// @ts-expect-error
import * as Bar from "./Bar.twig";

export default defineTest({
    get props() {
        return {
            Foo: Foo.default,
            Bar: Bar.default,
            x: true,
        };
    },

    html: "<p>true, therefore Foo</p><!---->",

    async test({ props, target }) {
        props.x = false;
        await tick();

        expect(target.innerHTML).toEqual("<p>false, therefore Bar</p><!---->");
    },
});
