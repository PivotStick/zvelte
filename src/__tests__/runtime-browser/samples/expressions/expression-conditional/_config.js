import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            output1: undefined,
            output2: undefined,

            foo1: false,
            foo2: true,
        };
    },
    test({ props }) {
        expect(props.output1).toEqual("bar");
        expect(props.output2).toEqual("foo");
    },
});
