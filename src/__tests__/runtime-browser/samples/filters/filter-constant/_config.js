import { defineTest } from "../../../defineTest.js";

const value = {
    some: "value",
    of: true,
    insane: 42,
    stuffs: ["orange", "potato"],
};

export default defineTest({
    props: { value },

    html: JSON.stringify(value, null, 4),
});
