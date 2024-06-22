import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    async test({ target }) {
        const [input1, input2] = target.querySelectorAll("input");
        expect(input1.value).toEqual("something");
        expect(input2.value).toEqual("something");

        input1.value = "abc";
        input1.dispatchEvent(new window.Event("input"));
        await tick();

        expect(input1.value).toEqual("abc");
        expect(input2.value).toEqual("abc");

        target
            .querySelector("button")
            ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        await tick();

        expect(input1.value).toEqual("Reset");
        expect(input2.value).toEqual("Reset");
    },
});
