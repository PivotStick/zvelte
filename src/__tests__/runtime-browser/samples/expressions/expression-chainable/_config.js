import { defineTest } from "../../../defineTest.js";

export default defineTest({
    todo: true,
});

// describe("chainable expression", () => {
//     test("mega complex", () => {
//         // The most complex expression just for fun
//
//         const theAnswerToAll = 42;
//
//         ExpressionOf(
//             "foo.bar()[10]|filter|test('hello').why['so' ~ long]()",
//             theAnswerToAll,
//             {
//                 foo: {
//                     bar: () => {
//                         return {
//                             10: "_secret_value_",
//                         };
//                     },
//                 },
//                 /**
//                  * @param {string} value
//                  */
//                 filter(value) {
//                     return [...value]
//                         .map((c) => c.charCodeAt(0))
//                         .reduce((a, n) => a + n, 0);
//                 },
//                 /**
//                  * @param {number} number
//                  * @param {string} value
//                  */
//                 test(number, value) {
//                     number += [...value]
//                         .map((c) => c.charCodeAt(0))
//                         .reduce((a, n) => a + n, 0);
//
//                     return {
//                         why: {
//                             so_crazy: () => {
//                                 const ns = String(number)
//                                     .split("")
//                                     .toReversed();
//                                 ns.splice(1, 2);
//                                 return +ns.join("");
//                             },
//                         },
//                     };
//                 },
//                 long: "_crazy",
//             }
//         );
//     });
// });
