import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<button>toggle</button> <!---->",

    async test({ target }) {
        const button = target.querySelector("button");
        const event = new window.MouseEvent("click", { bubbles: true });

        button?.dispatchEvent(event);
        await tick();

        expect(target.innerHTML).toEqual(
            "<button>toggle</button> <p>hello!</p><!---->"
        );

        button?.dispatchEvent(event);
        await tick();

        expect(target.innerHTML).toEqual("<button>toggle</button> <!---->");
    },
});
