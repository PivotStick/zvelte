import { tick } from "@pivotass/zvelte";
import { defineTest } from "../../defineTest.js";
import { expect } from "vitest";

export default defineTest({
    html: "<p>clicks: 0</p><!----> <button>click me</button><!---->",

    async test({ target }) {
        const btn = target.querySelector("button");

        btn?.click();
        await tick();
        expect(target.innerHTML).toEqual(
            "<p>clicks: 1</p><!----> <button>click me</button><!---->"
        );
    },
});
