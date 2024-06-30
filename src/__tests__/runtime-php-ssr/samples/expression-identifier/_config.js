import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            foo: "Hey",
        };
    },
    html: `Hey\n`,
});
