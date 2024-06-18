import { expect } from "vitest";
import { defineTest, ok } from "../../defineTest.js";
import { tick } from "../../../../internal/client/index.js";

export default defineTest({
    get props() {
        return { inputType: "text", inputValue: 42 };
    },

    html: '<input type="text">',

    async test({ props, target }) {
        const input = target.querySelector("input");
        ok(input);

        expect(input.type).toEqual("text");
        expect(input.value).toEqual("42");

        props.inputType = "number";
        await tick();
        expect(input.type).toEqual("number");
    },
});
