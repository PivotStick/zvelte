import { defineTest } from "../../../defineTest.js";

export default defineTest({
    html: [
        "I like Twig.",
        "  I like Twig",
        "I like Twig.  ",
        "  I like Twig.",
    ].join("\n\n"),
});
