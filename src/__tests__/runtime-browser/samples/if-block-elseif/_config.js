import { tick } from "svelte";
import { defineTest } from "../../defineTest.js";
import { expect } from "vitest";

export default defineTest({
    get props() {
        return { x: 11 };
    },

    html: "<!----><p>x is greater than 10</p>",

    async test({ props, target }) {
        props.x = 4;
        await tick();
        expect(target.innerHTML, "<!----><p>x is less than 5</p>");

        props.x = 6;
        await tick();
        expect(target.innerHTML, "<!----><p>x is between 5 and 10</p>");
    },
});
