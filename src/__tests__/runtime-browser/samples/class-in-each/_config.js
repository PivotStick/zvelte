import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return {
            things: ["one", "two", "three"],
            selected: "two",
        };
    },

    html: '<div></div><div class="selected"></div><div></div>',

    async test({ props, target }) {
        props.selected = "three";
        await tick();
        expect(target.innerHTML).toEqual(
            '<div></div><div class=""></div><div class="selected"></div>',
        );
    },
});
