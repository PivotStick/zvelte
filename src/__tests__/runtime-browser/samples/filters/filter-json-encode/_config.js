import { defineTest } from "../../../defineTest.js";

const item = {
    foo: true,
    bar: "hello",
    stuffs: [1, 2, 3],
    user: {
        firstName: "joe",
        lastName: "doe",
    },
};

export default defineTest({
    props: {
        item,
    },

    html: JSON.stringify(item),
});
