import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return { user: { active: true } };
    },

    html: '<div class="active"></div>',

    async test({ props, target }) {
        props.user = { active: false };
        await tick();

        expect(target.innerHTML).toEqual(`<div class=""></div>`);
    },
});
