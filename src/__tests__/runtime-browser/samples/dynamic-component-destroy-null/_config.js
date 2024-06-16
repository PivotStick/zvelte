import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {
            x: true,
        };
    },

    async test({ props }) {
        props.x = false;
        await tick();
    },
});
