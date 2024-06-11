import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        singleQuotes: undefined,
        doubleQuotes: undefined,
    },
    test({ props }) {
        expect(props.singleQuotes).toEqual("hello world!");
        expect(props.doubleQuotes).toEqual("hello world!");
    },
});
