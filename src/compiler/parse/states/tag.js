import { Parser } from "../index.js";
import { readExpression } from "../read/expression.js";
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
    parser.allowWhitespace();
    const type = parser.eat("@html") ? "HtmlTag" : "ExpressionTag";
    const expression = readExpression(parser.readUntil(/}}/), parser);
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

    if (parser.eat("else")) return next(parser);
    if (parser.eat("end")) return close(parser);

    return open(parser, start);
}

/**
 * @param {Parser} parser
 * @param {number} start
 */
function open(parser, start) {
    if (parser.eat("if")) {
        parser.requireWhitespace();

        /** @type {import("../types.js").IfBlock} */
        const block = parser.append({
            type: "IfBlock",
            elseif: false,
            start,
            end: -1,
            test: readExpression(parser.readUntil(/%}/), parser),
            consequent: createFragment(),
            alternate: undefined,
        });

        parser.allowWhitespace();
        parser.eat("%}", true);

        parser.stack.push(block);
        parser.fragments.push(block.consequent);

        return;
    }

    if (parser.eat("for")) {
        parser.requireWhitespace();
        let keyVar = null;
        let context = null;

        context = readExpression(parser.readUntil(/[,\s]/), parser);
        parser.allowWhitespace();

        if (parser.eat(",")) {
            parser.allowWhitespace();
            keyVar = context;
            context = readExpression(parser.readUntil(/\s/), parser);
            parser.allowWhitespace();
        }

        parser.eat("in", true);
        const expression = readExpression(parser.readUntil(/%}/), parser);
        parser.eat("%}", true);

        /** @type {import("../types.js").ForBlock} */
        const block = parser.append({
            start,
            end: null,
            type: "ForBlock",
            expression,
            context,
            body: createFragment(),
            fallback: undefined,
        });

        parser.stack.push(block);
        parser.fragments.push(block.body);

        return;
    }

    if (parser.eat("set")) {
        parser.requireWhitespace();

        let name = readExpression(parser.readUntil(/\s*=/), parser);
        if (name.type !== "Identifier" && name.type !== "MemberExpression") {
            throw parser.error(`Unexpected ${name.type}`);
        }
        parser.allowWhitespace();
        parser.eat("=", true);
        let value = readExpression(parser.readUntil(/%}/), parser);
        parser.eat("%}", true);

        /**
         * @type {import("../types.js").Variable}
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
 */
function next(parser) {
    const block = parser.current();

    if (block.type === "IfBlock") {
        block.alternate = createFragment();

        parser.fragments.pop();
        parser.fragments.push(block.alternate);

        // {% elseif ... %}
        if (parser.eat("if")) {
            parser.requireWhitespace();

            const expression = readExpression(parser.readUntil(/%}/), parser);
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
 */
function close(parser) {
    let block = parser.current();

    switch (block.type) {
        case "IfBlock": {
            parser.eat("if", true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            while (block.elseif) {
                block.end = parser.index;
                parser.stack.pop();
                block = /** @type {import('../types.d.ts').IfBlock} */ (
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
            break;
        }

        default:
            throw parser.error(`Unexpected end block`);
    }
}
