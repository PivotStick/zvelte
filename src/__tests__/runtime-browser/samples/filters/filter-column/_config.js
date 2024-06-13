import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        items: [{ fruit: "apple" }, { fruit: "orange" }],
        output: undefined,
    },
    test({ props }) {
        expect(props.output).toEqual(["apple", "orange"]);
    },
});
