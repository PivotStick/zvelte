import { expect } from "vitest";
import { tick } from "../../../../internal/client/index.js";
import { defineTest } from "../../defineTest.js";

export default defineTest({
    get props() {
        return {};
    },

    todo: true,
    html: "",

    async test({ props, target }) {},
});
