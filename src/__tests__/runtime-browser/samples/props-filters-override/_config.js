import { defineTest } from "../../defineTest.js";

export default defineTest({
    props: {
        slice() {
            return "nope";
        },
    },

    html: "<p>nope</p>",
});
