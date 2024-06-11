import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo: "bar" + "_baz",
        };
    },
    html: "bar_baz",
});
