import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            visible: false,
        };
    },

    html: "<!---->",

    async test({ props, target }) {
        props.visible = true;
        await tick();

        expect(target.innerHTML).toEqual("<!----><!---->");
    },
});
