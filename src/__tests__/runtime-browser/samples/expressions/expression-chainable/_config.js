import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo: {
                bar: () => {
                    return {
                        10: "_secret_value_",
                    };
                },
            },
            /**
             * @param {string} value
             */
            someFilter(value) {
                return [...value]
                    .map((c) => c.charCodeAt(0))
                    .reduce((a, n) => a + n, 0);
            },
            /**
             * @param {number} number
             * @param {string} value
             */
            test(number, value) {
                number += [...value]
                    .map((c) => c.charCodeAt(0))
                    .reduce((a, n) => a + n, 0);

                return {
                    why: {
                        so_crazy: () => {
                            const ns = String(number).split("").toReversed();
                            ns.splice(1, 2);
                            return +ns.join("");
                        },
                    },
                };
            },

            long: "_crazy",
            theAnswerToAll: undefined,
        };
    },

    test({ props }) {
        expect(props.theAnswerToAll).toBe(42);
    },
});
