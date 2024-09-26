import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<!----><p>clicks: 0, doubled: 0</p><!----> <button>click me</button>",

    async test({ target }) {
        const btn = target.querySelector("button");

        btn?.click();
        await tick();
        expect(target.innerHTML).toEqual(
            "<!----><p>clicks: 1, doubled: 2</p><!----> <button>click me</button>",
        );
    },
});
