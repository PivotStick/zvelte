import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        output1: undefined,
        output2: undefined,
        output3: undefined,
        output4: undefined,
    },
    test({ props }) {
        expect(props.output1).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(props.output2).toEqual([-5, -4, -3, -2, -1, 0]);
        expect(props.output3).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
        expect(props.output4).toEqual([-2, -3, -4]);
    },
});
