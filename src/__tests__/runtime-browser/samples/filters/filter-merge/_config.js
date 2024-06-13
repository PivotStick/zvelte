import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            values: [1, 2],
            items: {
                apple: "fruit",
                orange: "fruit",
                peugeot: "unknown",
            },

            output1: undefined,
            output2: undefined,
        };
    },

    test({ props }) {
        expect(props.output1).toEqual([1, 2, "apple", "orange"]);
        expect(props.output2).toEqual({
            apple: "fruit",
            orange: "fruit",
            peugeot: "car",
            renault: "car",
        });
    },
});
