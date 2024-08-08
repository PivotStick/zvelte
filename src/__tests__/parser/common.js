import { expect } from "vitest";
import { parse } from "../../compiler/phases/1-parse/index.js";

/**
 * It creates a Root node without js nor css
 *
 * @param {string} source
 * @param {import("#ast").Fragment["nodes"]} nodes
 */
export function TemplateRootOf(source, nodes) {
    const expectedAST = {
        type: "Root",
        css: null,
        js: null,
        start: 0,
        end: source.length,
        imports: [],
        fragment: {
            type: "Fragment",
            start: 0,
            end: source.length,
            transparent: false,
            nodes,
        },
    };

    expect(parse(source)).toEqual(expectedAST);
}

/**
 * @param {string} source
 * @param {import("#ast").Expression} expression
 */
export const ExpressionTagOf = (source, expression) => {
    TemplateRootOf(source, [
        {
            type: "ExpressionTag",
            start: 0,
            end: source.length,
            expression,
        },
    ]);
};
