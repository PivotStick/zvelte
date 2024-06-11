import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<button>clicks: 10</button>",

    async test({ target }) {
        const button = /** @type {HTMLButtonElement} */ (
            target.querySelector("button")
        );

        button.click();
        await tick();

        expect(target.innerHTML).toBe("<button>clicks: 11</button>");
    },
});
