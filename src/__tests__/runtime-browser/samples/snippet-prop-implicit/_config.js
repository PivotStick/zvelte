import { tick } from "@pivotass/zvelte";
import { defineTest } from "../../defineTest.js";
import { expect } from "vitest";

export default defineTest({
    html: "<zvelte><p>clicks: 0</p><!----> <button>click me</button></zvelte>",

    async test({ target }) {
        const btn = target.querySelector("button");

        btn?.click();
        await tick();
        expect(target.innerHTML).toEqual(
            "<zvelte><p>clicks: 1</p><!----> <button>click me</button></zvelte>"
        );
    },
});
