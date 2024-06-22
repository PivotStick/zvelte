import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    html: `child: 0<!----> parent: 0 <button>inc x</button>`,

    async test({ target }) {
        target.querySelector("button")?.click();
        await tick();
        expect(target.innerHTML).toEqual(
            `child: 1<!----> parent: 1 <button>inc x</button>`
        );
    },
});
