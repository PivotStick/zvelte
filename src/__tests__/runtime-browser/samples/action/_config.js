import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    html: "<button>action</button>",

    async test({ target }) {
        const button = target.querySelector("button");
        ok(button);

        const eventEnter = new window.MouseEvent("mouseenter");
        const eventLeave = new window.MouseEvent("mouseleave");

        button.dispatchEvent(eventEnter);
        expect(target.innerHTML).toEqual(
            '<button>action</button><div class="tooltip">Perform an Action</div>'
        );

        button.dispatchEvent(eventLeave);
        expect(target.innerHTML).toEqual("<button>action</button>");
    },
});
