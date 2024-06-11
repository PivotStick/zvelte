import { expect } from "vitest";
import { defineTest } from "../../../defineTest.js";

export default defineTest({
    get props() {
        return {};
    },

    todo: true,

    async test({ props }) {
        // function validate(not = false) {
        //     const expression = `foo is${not ? " not" : ""} empty`;
        //
        //     ExpressionOf(expression, !not);
        //     ExpressionOf(expression, !not, { foo: null });
        //     ExpressionOf(expression, !not, { foo: "" });
        //     ExpressionOf(expression, !not, { foo: 0 });
        //     ExpressionOf(expression, !not, { foo: [] });
        //     ExpressionOf(expression, !not, { foo: {} });
        //
        //     ExpressionOf(expression, not, { foo: "null" });
        //     ExpressionOf(expression, not, { foo: "value" });
        //     ExpressionOf(expression, not, { foo: 10 });
        //     ExpressionOf(expression, not, { foo: -10 });
        //     ExpressionOf(expression, not, { foo: ["value"] });
        //     ExpressionOf(expression, not, { foo: { key: "value" } });
        // }
        //
        // validate(false);
        // validate(true);
    },
});
