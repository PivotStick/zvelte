import { Parser } from "../index.js";
import { parseExpression, parseIdentifier } from "../read/expression.js";
import { createFragment } from "../utils/createFragment.js";

/**
 * @param {Parser} parser
 */
export const tag = (parser) => {
    parser.index++;

    if (parser.eat("%")) return block(parser);
    if (parser.eat("{")) return expressionTag(parser);

    throw parser.error(`Unexpected token`);
};

/**
 * @param {Parser} parser
 */
function expressionTag(parser) {
    const start = parser.index - 2;
    let type = "ExpressionTag";

    parser.allowWhitespace();
    if (parser.eat("@html")) {
        type = "HtmlTag";
        parser.allowWhitespace();
    }

    const expression = parseExpression(parser);
    parser.allowWhitespace();
    parser.eat("}}", true);

    /**
     * @type {import("../types.js").Tag }
     */
    parser.append({
        start,
        end: parser.index,
        type,
        expression,
    });
}

/**
 * @param {Parser} parser
 */
function block(parser) {
    const start = parser.index - 2;
    parser.allowWhitespace();

    if (parser.eat("else")) return next(parser, start);
    if (parser.eat("end")) return close(parser, start);

    return open(parser, start);
}

/**
 * @param {Parser} parser
 * @param {number} start
 */
function open(parser, start) {
    if (parser.eat("if")) {
        parser.requireWhitespace();
        const test = parseExpression(parser);

        /** @type {import("../types.js").IfBlock} */
        const block = parser.append({
            type: "IfBlock",
            elseif: false,
            start,
            end: -1,
            test,
            consequent: createFragment(),
            alternate: null,
        });

        parser.allowWhitespace();
        parser.eat("%}", true);

        block.consequent.start = parser.index;

        parser.stack.push(block);
        parser.fragments.push(block.consequent);

        return;
    }

    if (parser.eat("for")) {
        parser.requireWhitespace();
        let key;
        let context = parseIdentifier(parser);
        if (!context) throw parser.error("Expected an Identifier");
        parser.allowWhitespace();

        if (parser.eat(",")) {
            parser.allowWhitespace();
            key = context;
            context = parseIdentifier(parser);
            if (!context) throw parser.error("Expected an Identifier");
            parser.allowWhitespace();
        }

        parser.eat("in", true);
        parser.requireWhitespace();
        const expression = parseExpression(parser);
        parser.allowWhitespace();
        parser.eat("%}", true);

        /** @type {import("../types.js").ForBlock} */
        const block = parser.append({
            start,
            end: -1,
            type: "ForBlock",
            expression,
            key,
            context,
            body: createFragment(),
            fallback: undefined,
        });

        block.body.start = parser.index;

        parser.stack.push(block);
        parser.fragments.push(block.body);

        return;
    }

    if (parser.eat("set")) {
        parser.requireWhitespace();

        let name = parseExpression(parser);
        if (name.type !== "Identifier" && name.type !== "MemberExpression") {
            throw parser.error(`Unexpected ${name.type}`);
        }
        parser.allowWhitespace();
        parser.eat("=", true);
        parser.allowWhitespace();
        let value = parseExpression(parser);
        parser.allowWhitespace();
        parser.eat("%}", true);

        /**
         * @type {import("../types.js").VariableTag}
         */
        parser.append({
            type: "Variable",
            start,
            end: parser.index,
            name,
            value,
        });

        return;
    }

    throw parser.error(`Unknown block type`);
}

/**
 * @param {Parser} parser
 * @param {number} start
 */
function next(parser, start) {
    const block = parser.current();
    parser.currentFrag().end = start;

    if (block.type === "IfBlock") {
        block.alternate = createFragment();

        parser.fragments.pop();
        parser.fragments.push(block.alternate);

        // {% elseif ... %}
        if (parser.eat("if")) {
            parser.requireWhitespace();

            const expression = parseExpression(parser);
            parser.allowWhitespace();
            parser.eat("%}", true);

            /** @type {import("../types.js").IfBlock} */
            const child = parser.append({
                start: parser.index,
                end: -1,
                type: "IfBlock",
                elseif: true,
                test: expression,
                consequent: createFragment(),
                alternate: null,
            });

            child.consequent.start = parser.index;

            parser.stack.push(child);
            parser.fragments.pop();
            parser.fragments.push(child.consequent);
        } else {
            // {% else %}
            parser.allowWhitespace();
            parser.eat("%}", true);
        }

        return;
    }

    if (block.type === "ForBlock") {
        parser.allowWhitespace();
        parser.eat("%}", true);

        block.fallback = createFragment();
        block.fallback.start = parser.index;

        parser.fragments.pop();
        parser.fragments.push(block.fallback);

        return;
    }

    throw parser.error(
        "{% else %} block is invalid at this position (did you forget to close the preceeding element or block?)",
    );
}

/**
 * @param {Parser} parser
 * @param {number} start
 */
function close(parser, start) {
    let block = parser.current();
    parser.currentFrag().end = start;

    switch (block.type) {
        case "IfBlock": {
            parser.eat("if", true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            while (block.elseif) {
                block.end = parser.index;
                parser.stack.pop();
                block = /** @type {import('../types.js').IfBlock} */ (
                    parser.current()
                );
            }

            block.end = parser.index;
            parser.pop();
            break;
        }

        case "ForBlock": {
            parser.eat("for", true);
            parser.allowWhitespace();
            parser.eat("%}", true);
            parser.pop();

            block.end = parser.index;
            break;
        }

        default:
            throw parser.error(`Unexpected end block`);
    }
}
