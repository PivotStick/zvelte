import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            arrow1: /** @type {any} */ (undefined),
        };
    },
    test({ props }) {
        expect(props.arrow1).toBeTypeOf("function");
        expect(props.arrow1).toBeInstanceOf(Function);
        expect(props.arrow1(1, 2, 3)).toBe(7);
        expect(props.arrow1(3, 2, 1)).toBe(5);
    },
});
