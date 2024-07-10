import { defineTest } from "../../../defineTest.js";

export default defineTest({
    props: {
        items: ["a", "b", "c", "d"],
    },

    html: "<table><tr><td>0 - a</td><td>1 - b</td><td>2 - c</td></tr><tr><td>3 - d</td><td>4 - No item</td><td>5 - No item</td></tr></table>",
});
