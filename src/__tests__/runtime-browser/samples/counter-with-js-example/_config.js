import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<button>clicks: 10</button>",

    async test({ target }) {
        const button = /** @type {HTMLButtonElement} */ (
            target.querySelector("button")
        );

        // Try 10 clicks
        for (let i = 0; i < 10; i++) {
            button.click();
            await tick();
            expect(target.innerHTML).toBe(
                `<button>clicks: ${10 + i + 1}</button>`
            );
        }
    },
});
