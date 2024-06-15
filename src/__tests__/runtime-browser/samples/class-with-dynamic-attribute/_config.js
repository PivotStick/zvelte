import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { myClass: "one two" };
    },

    html: '<div class="one two three"></div>',

    async test({ props, target }) {
        props.myClass = "one";
        await tick();
        expect(target.innerHTML).toEqual('<div class="one three"></div>');
    },
});
