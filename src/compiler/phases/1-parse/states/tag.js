import { Parser } from "../index.js";
import {
    parseAssignmentExpression,
    parseChainableExpression,
    parseExpression,
    parseIdentifier,
    parseStringLiteral,
} from "../read/expression.js";
import { createFragment } from "../utils/createFragment.js";

const regex_whitespace_with_closing_curly_brace = /^\s*%}/;

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
    } else if (parser.eat("@render")) {
        type = "RenderTag";
        parser.allowWhitespace();
    }

    const expression = parseExpression(parser);

    if (
        type === "RenderTag" &&
        expression.type !== "CallExpression" &&
        expression.type !== "FilterExpression"
    ) {
        throw parser.error(
            "`{{ @render ... }` tags can only contain call expressions",
            expression.start,
        );
    }

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

    if (parser.eat("else") || parser.match("then") || parser.match("catch"))
        return next(parser, start);

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
        let index = null;
        let context = parseIdentifier(parser);
        if (!context) throw parser.error("Expected an Identifier");
        parser.allowWhitespace();

        if (parser.eat(",")) {
            parser.allowWhitespace();
            index = context;
            context = parseIdentifier(parser);
            if (!context) throw parser.error("Expected an Identifier");
            parser.allowWhitespace();
        }

        parser.eat("in", true);
        parser.requireWhitespace();
        const expression = parseExpression(parser);
        let key = null;
        parser.allowWhitespace();
        if (parser.eat("#")) {
            parser.eat("(", true);
            key = parseChainableExpression(parser);
            if (key?.type !== "Identifier" && key?.type !== "MemberExpression")
                throw parser.error(
                    "Expected an Identifier or a MemberExpression",
                );

            parser.eat(")", true);
            parser.allowWhitespace();
        }
        parser.eat("%}", true);

        /** @type {import("../types.js").ForBlock} */
        const block = parser.append({
            start,
            end: -1,
            type: "ForBlock",
            expression,
            index,
            key,
            context,
            body: createFragment(),
            fallback: null,
        });

        block.body.start = parser.index;

        parser.stack.push(block);
        parser.fragments.push(block.body);

        return;
    }

    if (parser.eat("set")) {
        parser.requireWhitespace();

        const assignment = parseAssignmentExpression(parser);

        if (assignment.type !== "AssignmentExpression")
            throw parser.error("AssignmentExpression expected");

        parser.allowWhitespace();
        parser.eat("%}", true);

        parser.append(
            /** @type {import("../types.js").VariableTag} */ ({
                type: "VariableTag",
                start,
                end: parser.index,
                assignment,
            }),
        );

        return;
    }

    if (parser.eat("import")) {
        parser.requireWhitespace();
        const specifier = parseIdentifier(parser);
        if (!specifier) throw parser.error(`Expected Identifier`);

        parser.requireWhitespace();
        parser.eat("from", true);
        parser.requireWhitespace();

        const source = parseStringLiteral(parser);
        if (!source) throw parser.error(`Expected StringLiteral`);

        parser.allowWhitespace();
        parser.eat("%}", true);

        parser.root.imports.push({
            type: "ImportTag",
            start,
            end: parser.index,
            source,
            specifier,
        });
        return;
    }

    if (parser.eat("snippet")) {
        parser.requireWhitespace();
        const expression = parseIdentifier(parser);
        if (!expression) {
            throw parser.error("Expected an identifier");
        }

        const parameters = [];

        parser.allowWhitespace();
        parser.eat("(", true);
        parser.allowWhitespace();
        while (!parser.eat(")")) {
            const param = parseIdentifier(parser);
            if (!param) {
                throw parser.error("Expected an identifier");
            }

            parameters.push(param);
            parser.allowWhitespace();
            if (!parser.match(")")) {
                parser.eat(",", true);
                parser.allowWhitespace();
            }
        }
        parser.allowWhitespace();

        parser.eat("%}", true);

        /** @type {import("../types.js").SnippetBlock} */
        const block = parser.append({
            type: "SnippetBlock",
            start,
            end: parser.index,
            expression,
            parameters,
            body: createFragment(),
        });

        block.body.start = parser.index;

        parser.stack.push(block);
        parser.fragments.push(block.body);

        return;
    }

    if (parser.eat("key")) {
        parser.requireWhitespace();
        const expression = parseExpression(parser);
        parser.allowWhitespace();
        parser.eat("%}", true);

        /** @type {import("../types.js").KeyBlock} */
        const block = parser.append({
            type: "KeyBlock",
            start,
            end: -1,
            expression,
            fragment: createFragment(),
        });

        block.fragment.start = parser.index;

        parser.stack.push(block);
        parser.fragments.push(block.fragment);

        return;
    }

    if (parser.eat("await")) {
        parser.requireWhitespace();
        const expression = parseExpression(parser);
        parser.allowWhitespace();

        /** @type {ReturnType<typeof parser.append<import('#ast').AwaitBlock>>} */
        const block = parser.append({
            type: "AwaitBlock",
            start,
            end: -1,
            expression,
            error: null,
            pending: null,
            value: null,
            then: null,
            catch: null,
        });

        if (parser.eat("then")) {
            if (parser.matchRegex(regex_whitespace_with_closing_curly_brace)) {
                parser.allowWhitespace();
            } else {
                parser.requireWhitespace();
                const value = parseIdentifier(parser);
                if (!value) throw parser.error(`Expected Identifier`);
                block.value = value;
                parser.allowWhitespace();
            }

            block.then = createFragment();
            parser.fragments.push(block.then);
        } else if (parser.eat("catch")) {
            if (parser.matchRegex(regex_whitespace_with_closing_curly_brace)) {
                parser.allowWhitespace();
            } else {
                parser.requireWhitespace();
                const value = parseIdentifier(parser);
                if (!value) throw parser.error(`Expected Identifier`);
                block.error = value;
                parser.allowWhitespace();
            }

            block.catch = createFragment();
            parser.fragments.push(block.catch);
        } else {
            block.pending = createFragment();
            parser.fragments.push(block.pending);
        }

        parser.eat("%}", true);
        parser.fragments[parser.fragments.length - 1].start = parser.index;
        parser.stack.push(block);
        return;
    }

    throw parser.error(
        `Unknown block type`,
        start,
        (parser.template.slice(start).match(/%}/)?.index ?? start) + start + 2,
    );
}

/**
 * @param {Parser} parser
 * @param {number} start
 */
function next(parser, start) {
    const block = parser.current();
    parser.currentFrag().end = start;

    if (block.type === "AwaitBlock") {
        if (parser.eat("then")) {
            if (block.then) {
                throw parser.error(
                    `{% then %} cannot appear more than once within a block`,
                );
            }

            if (!parser.matchRegex(regex_whitespace_with_closing_curly_brace)) {
                parser.requireWhitespace();
                const value = parseIdentifier(parser);
                if (!value) throw parser.error(`Expected an Indentifier`);
                block.value = value;
                parser.allowWhitespace();
                parser.eat("%}", true);
            }

            block.then = createFragment();
            block.then.start = parser.index;
            parser.fragments.pop();
            parser.fragments.push(block.then);
            return;
        }

        if (parser.eat("catch")) {
            if (block.catch) {
                throw parser.error(
                    `{% catch %} cannot appear more than once within a block`,
                );
            }

            if (!parser.matchRegex(regex_whitespace_with_closing_curly_brace)) {
                parser.requireWhitespace();
                const value = parseIdentifier(parser);
                if (!value) throw parser.error(`Expected an Indentifier`);
                block.error = value;
                parser.allowWhitespace();
                parser.eat("%}", true);
            }

            block.catch = createFragment();
            block.catch.start = parser.index;
            parser.fragments.pop();
            parser.fragments.push(block.catch);
            return;
        }

        throw parser.error(
            "Expected token {% then ... %} or {% catch ... %}",
            start,
        );
    }

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
                start,
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

        block.alternate.start = parser.index;
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

                // @ts-expect-error
                block.alternate.end = start;
            }

            block.end = parser.index;
            parser.pop();
            break;
        }

        case "ForBlock": {
            parser.eat("for", true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            block.end = parser.index;
            parser.pop();
            break;
        }

        case "SnippetBlock": {
            parser.eat("snippet", true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            block.end = parser.index;
            parser.pop();
            break;
        }

        case "KeyBlock": {
            parser.eat("key", true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            block.end = parser.index;
            parser.pop();
            break;
        }

        case "AwaitBlock": {
            parser.eat("await", true);
            parser.allowWhitespace();
            parser.eat("%}", true);

            block.end = parser.index;
            parser.pop();
            break;
        }

        default:
            throw parser.error(
                `Unexpected end block`,
                start,
                (parser.template.slice(start).match(/%}/)?.index ?? start) +
                    start +
                    2,
            );
    }
}
