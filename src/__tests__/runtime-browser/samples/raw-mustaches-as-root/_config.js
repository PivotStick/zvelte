import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            content1: `<p>First line</p>`,
            content2: `<p>Another first line</p>`,
            content: undefined,

            show: false,
        };
    },

    html: "<button>Switch</button> <p>Another first line</p><!----><!----> <p>This line should be last.</p>",

    async test({ target }) {
        const btn = target.querySelector("button");
        ok(btn);

        const clickEvent = new window.MouseEvent("click", { bubbles: true });

        btn.dispatchEvent(clickEvent);
        await tick();

        expect(target.innerHTML).toEqual(
            "<button>Switch</button> <p>First line</p><!----><!----> <p>This line should be last.</p>"
        );

        btn.dispatchEvent(clickEvent);
        await tick();

        expect(target.innerHTML).toEqual(
            "<button>Switch</button> <p>Another first line</p><!----><!----> <p>This line should be last.</p>"
        );
    },
});
