import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        output1: undefined,
        output2: undefined,
    },
    test({ props }) {
        expect(props.output1).toEqual(true);
        expect(props.output2).toEqual(false);
    },
});
