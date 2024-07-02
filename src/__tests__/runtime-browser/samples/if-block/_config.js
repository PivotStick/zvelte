import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { visible: true };
    },

    html: "<p>i am visible</p>",

    async test({ props, target }) {
        props.visible = false;
        await tick();
        expect(target.innerHTML).toEqual("");

        props.visible = true;
        await tick();
        expect(target.innerHTML).toEqual("<p>i am visible</p>");
    },
});
