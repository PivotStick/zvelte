import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { foo: true, bar: false };
    },

    html: "<p>foo</p><!----> <p>not bar</p><!---->",

    async test({ props, target }) {
        props.foo = false;
        await tick();
        expect(target.innerHTML).toEqual(
            "<p>not foo</p><!----> <p>not bar</p><!---->"
        );

        props.bar = true;
        await tick();
        expect(target.innerHTML).toEqual(
            "<p>not foo</p><!----> <p>bar</p><!---->"
        );

        props.foo = true;
        await tick();
        expect(target.innerHTML).toEqual("<p>foo</p><!----> <p>bar</p><!---->");
    },
});
