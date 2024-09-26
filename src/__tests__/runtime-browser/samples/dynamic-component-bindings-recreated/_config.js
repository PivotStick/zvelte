import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

// @ts-expect-error
import Green from "./Green.zvelte";
// @ts-expect-error
import Red from "./Red.zvelte";

export default defineTest({
    get props() {
        return {
            Green,
            Red,
            x: true,
            foo: "one",
        };
    },

    html: "<!----><p>green one</p>",

    async test({ props, target }) {
        props.x = false;
        await tick();

        expect(target.innerHTML).toEqual("<!----><p>red one</p>");

        props.foo = "two";
        props.x = true;
        await tick();

        expect(target.innerHTML).toEqual("<!----><p>green two</p>");
    },
});
