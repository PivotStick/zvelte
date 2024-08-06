import { defineTest } from "../../defineTest.js";

// @ts-ignore
import Test from "./Test.zvelte";

export default defineTest({
    get props() {
        return {
            Test,
        };
    },

    test() {
        // should not crash
    },
});
