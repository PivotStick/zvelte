import { expect } from "vitest";
import { defineTest } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { name: "world" };
    },

    html: "<h1>Hello world!</h1>",

    async test({ props, target }) {
        props.name = "everybody";
        await tick();

        expect(target.innerHTML).toEqual("<h1>Hello everybody!</h1>");
    },
});
