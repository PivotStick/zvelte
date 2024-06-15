import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            myClass: "one two",
            /** @type {Record<string, any>} */
            attributes: { role: "button" },
        };
    },

    html: '<div class="one two three" role="button"></div>',

    async test({ props, target }) {
        props.myClass = "one";
        props.attributes = {
            "aria-label": "Test",
        };

        await tick();

        expect(target.innerHTML).toEqual(
            '<div class="one three" aria-label="Test"></div>'
        );
    },
});
