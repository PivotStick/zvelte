import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { foo: true, bar: true };
    },

    html: '<div class="foo bar"></div>',

    async test({ props, target }) {
        props.foo = false;
        await tick();
        expect(target.innerHTML).toEqual('<div class="bar"></div>');
    },
});
