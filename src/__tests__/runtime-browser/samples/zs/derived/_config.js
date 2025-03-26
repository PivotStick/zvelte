import { expect } from "vitest";
import { tick } from "../../../../../internal/client/index.js";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return { count: 0 };
    },

    html: "<button>0</button><p>doubled: 0</p>",

    async test({ target }) {
        const button = /** @type {HTMLButtonElement} */ (
            target.querySelector("button")
        );

        // Try 10 clicks
        for (let i = 0; i < 10; i++) {
            button.click();
            await tick();

            const count = i + 1;
            const doubled = count * 2;

            expect(target.innerHTML).toBe(
                `<button>${count}</button><p>doubled: ${doubled}</p>`,
            );
        }
    },
});
