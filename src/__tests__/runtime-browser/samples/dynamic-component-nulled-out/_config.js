import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-expect-error
import Foo from "./Foo.twig";

export default defineTest({
    get props() {
        return {
            Bar: Foo,
        };
    },

    html: "<p>Foo</p><!---->",

    async test({ props, target }) {
        props.Bar = null;
        await tick();

        expect(target.innerHTML).toEqual("<!---->");

        props.Bar = Foo;
        await tick();

        expect(target.innerHTML).toEqual("<p>Foo</p><!---->");
    },
});
