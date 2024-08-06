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
            foo: /** @type {any} */ ("green"),
        };
    },

    html: "<p>parent green</p> <p>green green</p><!---->",

    async test({ props, target }) {
        props.foo = undefined;
        props.x = false;
        await tick();

        expect(target.innerHTML).toEqual(
            "<p>parent red</p> <p>red red</p><!---->"
        );

        props.foo = undefined;
        props.x = true;
        await tick();

        expect(target.innerHTML).toEqual(
            "<p>parent green</p> <p>green green</p><!---->"
        );
    },
});
