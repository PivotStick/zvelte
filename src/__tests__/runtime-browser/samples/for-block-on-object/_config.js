import { defineTest } from "../../defineTest.js";

export default defineTest({
    props: {
        user: {
            firstName: "john",
            lastName: "doe",
            age: 23,
        },
    },

    html: [
        "<p>firstName: john</p>",
        "<p>lastName: doe</p>",
        "<p>age: 23</p>",
    ].join(""),
});
