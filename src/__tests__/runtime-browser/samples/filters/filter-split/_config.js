import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            output: undefined,
            outputLimit: undefined,
            foo: undefined,
            bar: undefined,
        };
    },

    test({ props }) {
        expect(props.output).toEqual(["one", "two", "three"]);
        expect(props.outputLimit).toEqual(["one", "two", "three,four,five"]);
        expect(props.foo).toEqual(["1", "2", "3"]);
        expect(props.bar).toEqual(["aa", "bb", "cc"]);
    },
});
