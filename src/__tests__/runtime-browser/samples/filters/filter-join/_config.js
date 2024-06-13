import { defineTest } from "../../../defineTest.js";

export default defineTest({
    html: ["123", "1|2|3", "1, 2 and 3"].join("\n\n"),
});
