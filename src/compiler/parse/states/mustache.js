import { readExpression } from "../read/expression.js";

/**
 * @param {import("../index.js").Parser} parser
 */
export const mustache = (parser) => {
    const start = parser.index;
    parser.index++;

    if (parser.eat("{")) {
        const expression = readExpression(parser.readUntil(/}}/), parser);
        parser.eat("}}", true);

        const node = {
            start,
            end: parser.index,
            type: "MustacheTag",
            expression,
        };

        parser.current().children.push(node);
    } else if (parser.eat("%")) {
        parser.allowWhitespace();

        // Closing block
        if (parser.eat("end")) {
            let block = parser.current();
            let expected;

            if (
                block.type === "IfBlock" ||
                (block.type === "ElseBlock" && block.in === "if")
            ) {
                expected = "if";
            }

            if (
                block.type === "ForBlock" ||
                (block.type === "ElseBlock" && block.in === "for")
            ) {
                expected = "for";
            }

            if (!expected) {
                throw parser.error(`Unexpected end block`);
            }

            if (block.type === "ElseBlock") {
                block.end = parser.index;
                parser.stack.pop();
                block = parser.current();
            }

            parser.eat(expected, true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            block.end = parser.index;
            parser.stack.pop();
        } else {
            // Opening block
            if (parser.eat("if") || parser.eat("elseif")) {
                const elseifToken = "elseif";
                const elseif = parser.template
                    .slice(parser.index - elseifToken.length)
                    .startsWith(elseifToken);

                parser.requireWhitespace();

                const expression = readExpression(
                    parser.readUntil(/%}/),
                    parser,
                );
                parser.eat("%}");

                const block = {
                    start,
                    end: null,
                    type: "IfBlock",
                    expression,
                    elseif,
                    children: [],
                };

                if (elseif) {
                    parser.current().end = start;
                    parser.current().else = block;
                    parser.stack.pop();
                } else {
                    parser.current().children.push(block);
                }
                parser.stack.push(block);
            } else if (parser.eat("else")) {
                parser.requireWhitespace();
                parser.eat("%}");

                const block = {
                    start,
                    end: null,
                    type: "ElseBlock",
                    children: [],
                };

                const parent = parser.current();

                if (parent.type === "IfBlock") {
                    block.in = "if";
                }

                if (parent.type === "ForBlock") {
                    block.in = "for";
                }

                if (!block.in) {
                    throw parser.error(
                        "Else block can only be in an IfBlock or in a ForBlock",
                    );
                }

                parent.else = block;
                parser.stack.push(block);
            } else if (parser.eat("for")) {
                parser.requireWhitespace();
                let keyVar = null;
                let itemVar = null;

                itemVar = parser.readUntil(/[,\s]/);
                parser.allowWhitespace();

                if (parser.eat(",")) {
                    parser.allowWhitespace();
                    keyVar = itemVar;
                    itemVar = parser.readUntil(/\s/);
                    parser.allowWhitespace();
                }

                parser.eat("in", true);

                const expression = readExpression(
                    parser.readUntil(/%}/),
                    parser,
                );
                parser.eat("%}", true);

                const block = {
                    start,
                    end: null,
                    type: "ForBlock",
                    keyVar,
                    itemVar,
                    expression,
                    children: [],
                };

                parser.current().children.push(block);
                parser.stack.push(block);
            } else if (parser.eat("set")) {
                parser.requireWhitespace();

                let name = readExpression(parser.readUntil(/\s*=/), parser);
                if (
                    name.type !== "Identifier" &&
                    name.type !== "MemberExpression"
                ) {
                    throw parser.error(`Unexpected ${name.type}`);
                }
                parser.allowWhitespace();
                parser.eat("=", true);
                let value = readExpression(parser.readUntil(/%}/), parser);
                parser.eat("%}", true);

                const variable = {
                    type: "Variable",
                    start,
                    end: parser.index,
                    name,
                    value,
                };

                parser.current().children.push(variable);
            } else {
                throw parser.error(`Unknown block type`);
            }
        }
    }
};
