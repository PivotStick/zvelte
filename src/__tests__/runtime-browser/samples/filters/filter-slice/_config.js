import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            output1: undefined,
            output2: undefined,
        };
    },
    test({ props }) {
        expect(props.output1).toEqual([2, 3]);
        expect(props.output2).toEqual("23");
    },
});
