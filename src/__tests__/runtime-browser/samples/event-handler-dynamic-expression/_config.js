import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    html: "<button>bar</button>",

    async test({ target }) {
        const [button] = target.querySelectorAll("button");

        const event = new window.MouseEvent("click", { bubbles: true });

        button.dispatchEvent(event);
        await tick();
        expect(target.innerHTML).toEqual("<button>foo</button>");

        button.dispatchEvent(event);
        await tick();
        expect(target.innerHTML).toEqual("<button>bar</button>");

        button.dispatchEvent(event);
        await tick();
        expect(target.innerHTML).toEqual("<button>foo</button>");
    },
});
