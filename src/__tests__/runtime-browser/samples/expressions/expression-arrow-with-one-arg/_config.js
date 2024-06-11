import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            arrow1: /** @type {any} */ (undefined),
            arrow2: /** @type {any} */ (undefined),
        };
    },
    test({ props }) {
        expect(props.arrow1).toBeTypeOf("function");
        expect(props.arrow1).toBeInstanceOf(Function);
        expect(props.arrow1()).toBe("undefined!");
        expect(props.arrow1("Hello")).toBe("Hello!");

        expect(props.arrow2).toBeTypeOf("function");
        expect(props.arrow2).toBeInstanceOf(Function);
        expect(props.arrow2()).toBe(NaN);
        expect(props.arrow2(10)).toBe(20);
    },
});
