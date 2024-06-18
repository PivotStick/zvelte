import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            color: "red",
        };
    },

    html: '<div style="color: red;">red</div>',

    async test({ props, target }) {
        const div = target.querySelector("div");
        ok(div);

        expect(div.style.color).toBe("red");

        props.color = "blue";
        await tick();
        expect(target.innerHTML).toEqual(
            '<div style="color: blue;">blue</div>'
        );
        expect(div.style.color).toBe("blue");
    },
});
