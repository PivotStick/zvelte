import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest, ok } from "../../defineTest.js";

// @ts-expect-error
import Comp1 from "./Comp1.zvelte";
// @ts-expect-error
import Comp2 from "./Comp2.zvelte";

export default defineTest({
    get props() {
        return {
            Comp1,
            Comp2,
        };
    },

    html: "<!----><p>value(1) = 1</p> <p>foo=bar</p> <p>typeof cb=function () {}</p><!----> <button>Toggle Component</button>",

    async test({ target }) {
        const button = target.querySelector("button");
        ok(button);

        button.dispatchEvent(new window.Event("click"));
        await tick();

        expect(target.innerHTML).toEqual(
            "<!----><p>value(2) = 2</p> <p>foo=bar</p> <p>typeof cb=function () {}</p><!----> <button>Toggle Component</button>",
        );

        button.dispatchEvent(new window.Event("click"));
        await tick();

        expect(target.innerHTML).toEqual(
            "<!----><p>value(1) = 1</p> <p>foo=bar</p> <p>typeof cb=function () {}</p><!----> <button>Toggle Component</button>",
        );
    },
});
