import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { hidden: true };
    },

    html: '<div hidden=""></div>',

    async test({ props, target }) {
        props.hidden = false;
        await tick();
        expect(target.innerHTML).toEqual("<div></div>");
    },
});
