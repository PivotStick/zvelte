import { defineTest } from "../../../defineTest.js";

export default defineTest({
    todo: true,
});

// describe("FilterExpression", () => {
//     test("Without args", () => {
//         const fn = vi.fn();
//
//         ExpressionOf(`foo()`, 30, { foo: () => 10 * 3 });
//         ExpressionOf(`foo()`, undefined, { foo: fn });
//
//         expect(fn).toHaveBeenCalledOnce();
//     });
//
//     test("With one arg", () => {
//         const foo = vi.fn((a) => a * 10);
//
//         ExpressionOf(`foo(10)`, 100, { foo });
//         ExpressionOf(`foo("5")`, 50, { foo });
//
//         expect(foo).toHaveBeenCalledTimes(2);
//         expect(foo.mock.results).toEqual([
//             { type: "return", value: 100 },
//             { type: "return", value: 50 },
//         ]);
//     });
//
//     test("With many args", () => {
//         const foo = vi.fn((a, b, suffix = "!") => a * b + suffix);
//
//         ExpressionOf(`foo(10, 10)`, "100!", { foo });
//         ExpressionOf(`foo(3, 2)`, "6!", { foo });
//         ExpressionOf(`foo(5, 5, " woaw!")`, "25 woaw!", { foo });
//
//         expect(foo).toHaveBeenCalledTimes(3);
//         expect(foo.mock.results).toEqual([
//             { type: "return", value: "100!" },
//             { type: "return", value: "6!" },
//             { type: "return", value: "25 woaw!" },
//         ]);
//     });
// });
