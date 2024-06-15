import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { primary: true };
    },

    html: '<div class="test-class primary" role="button"></div>',

    async test({ props, target }) {
        props.primary = true;

        await tick();

        expect(target.innerHTML).toEqual(
            '<div class="test-class primary" role="button"></div>'
        );
    },
});
