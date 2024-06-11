import { defineTest } from "../../../defineTest.js";

export default defineTest({
    todo: true,
});

// describe("CallExpression", () => {
//     test("Without args", () => {
//         const foo = vi.fn();
//
//         ExpressionOf(`bar.foo()`, 30, { bar: { foo: () => 10 * 3 } });
//         ExpressionOf(`bar.foo()`, undefined, { bar: { foo } });
//
//         expect(foo).toHaveBeenCalledOnce();
//     });
//
//     test("With one arg", () => {
//         const foo = vi.fn((a) => a * 10);
//
//         ExpressionOf(`bar.foo(10)`, 100, { bar: { foo } });
//         ExpressionOf(`bar.foo("5")`, 50, { bar: { foo } });
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
//         ExpressionOf(`bar.foo(10, 10)`, "100!", { bar: { foo } });
//         ExpressionOf(`bar.foo(3, 2)`, "6!", { bar: { foo } });
//         ExpressionOf(`bar.foo(5, 5, " woaw!")`, "25 woaw!", {
//             bar: { foo },
//         });
//
//         expect(foo).toHaveBeenCalledTimes(3);
//         expect(foo.mock.results).toEqual([
//             { type: "return", value: "100!" },
//             { type: "return", value: "6!" },
//             { type: "return", value: "25 woaw!" },
//         ]);
//     });
// });
