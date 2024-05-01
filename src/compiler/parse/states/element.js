import { is_void } from "../../shared/utils/names.js";
import { readExpression } from "../read/expression.js";
import * as csstree from "css-tree";
import { createFragment } from "../utils/createFragment.js";
import { Parser } from "../index.js";

const validTagName = /^\!?[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/;
const regexWhitespaceOrSlashOrClosingTag = /(\s|\/|>)/;
const regexTokenEndingCharacter = /[\s=\/>"']/;

/**
 * @param {Parser} parser
 */
export const element = (parser) => {
    const start = parser.index;
    parser.index++;

    // Ignore comments
    if (parser.eat("!--")) {
        const data = parser.readUntil(/-->/);
        parser.eat("-->", true);

        /** @type {ReturnType<typeof parser.append<import('../types.d.ts').Comment>>} */
        parser.append({
            type: "Comment",
            start,
            end: parser.index,
            data,
        });
        return;
    }

    const isClosingTag = parser.eat("/");
    const name = readTagName(parser);

    const type = !!parser.component?.name.test(name)
        ? "Component"
        : name === "slot"
          ? "SlotElement"
          : "Element";

    /**
     * @type {import("../types.d.ts").ElementLike}
     */
    // @ts-expect-error
    let element = {
        start,
        end: null,
        type,
        name,
        attributes: [],
        fragment: createFragment(),
    };

    parser.allowWhitespace();

    if (isClosingTag) {
        parser.eat(">", true);
        let parent = parser.current();

        while (parent.type === type ? parent.name !== name : true) {
            if (parent.type !== type) {
                throw parser.error(`"${name}" has no opening tag`);
            }
            parent.end = start;
            parser.pop();
            parent = parser.current();
        }

        parent.end = start;
        parser.pop();
        return;
    }

    /**
     * @type {import("../types.js").Element["attributes"][number]=}
     */
    let attribute;
    let uniqueNames = new Set();
    while ((attribute = readAttribute(parser, uniqueNames))) {
        if (element.type === "SlotElement") {
            if (attribute.type !== "Attribute")
                throw parser.error("`<slot>` can only receive attributes");
        }
        // @ts-expect-error
        element.attributes.push(attribute);
        parser.allowWhitespace();
    }

    const selfClosing = parser.eat("/") || is_void(name);

    parser.eat(">", true);

    if (element.type === "Component") {
        const keyAttrIndex = element.attributes.findIndex(
            (attr) => attr.name === parser.component?.key,
        );

        if (keyAttrIndex === -1) {
            throw parser.error(
                `A component must have a '${parser.component.key}' attribute`,
                start,
            );
        }

        const keyAttr = element.attributes.splice(keyAttrIndex, 1)[0];

        if (
            keyAttr.type !== "Attribute" ||
            keyAttr.value === true ||
            keyAttr.value.length !== 1 ||
            keyAttr.value[0].type !== "Text"
        ) {
            throw parser.error(
                `"${parser.component.key}" is expected to have a Text value only on a component`,
                keyAttr.start,
            );
        }

        element.key = keyAttr.value[0];
    }

    if (element.name === "style") {
        if (parser.root.css)
            throw parser.error(
                "Only one style tag can be declared in a component",
            );

        let code = "";
        let start = parser.index;
        let end = start;

        if (!selfClosing) {
            code = parser.readUntil(/<\/style>/);
            end = parser.index;
            parser.eat("</style>", true);
        }

        parser.root.css = {
            start,
            end,
            code,
            ast: csstree.toPlainObject(
                csstree.parse(code, {
                    offset: start,
                }),
            ),
        };
    } else {
        parser.append(element);

        if (selfClosing) {
            element.end = parser.index;
        } else {
            parser.stack.push(element);
            parser.fragments.push(element.fragment);
        }
    }
};

/**
 * @param {Parser} parser
 */
const readTagName = (parser) => {
    const name = parser.readUntil(regexWhitespaceOrSlashOrClosingTag);

    if (!validTagName.test(name)) {
        throw parser.error(`Invalid tag name "${name}"`);
    }

    return name;
};

/**
 * @param {Parser} parser
 * @param {Set<string>} uniqueNames
 * @returns {import("../types.js").Element["attributes"][number]}
 */
const readAttribute = (parser, uniqueNames) => {
    const start = parser.index;

    /**
     * @param {string} name
     */
    const checkUnique = (name) => {
        if (uniqueNames.has(name)) {
            throw parser.error(`Duplicate attribute "${name}"`);
        }
        uniqueNames.add(name);
    };

    const name = parser.readUntil(regexTokenEndingCharacter);
    if (!name) return null;
    let end = parser.index;

    parser.allowWhitespace();

    /**
     * @type {boolean | ReturnType<typeof readAttributeValue>}
     */
    let value = true;

    if (parser.eat("=")) {
        parser.allowWhitespace();
        value = readAttributeValue(parser);
        end = parser.index;
    }

    if (name.includes(":")) {
        if (value === true || value.length !== 1 || value[0].type === "Text") {
            throw parser.error(
                "Directive value must be an expression enclosed in curly braces",
                start,
            );
        }

        const expression = value[0];

        if (name.startsWith("on:")) {
            return {
                type: "OnDirective",
                start,
                end,
                expression,
                name: name.slice("on:".length),
                modifiers: [],
            };
        } else if (name.startsWith("bind:")) {
            if (
                expression.type !== "Identifier" &&
                expression.type !== "MemberExpression"
            ) {
                throw parser.error(
                    "Can only bind to an Identifier or MemberExpression",
                    start,
                );
            }

            return {
                type: "BindDirective",
                start,
                end,
                expression,
                name: name.slice("bind:".length),
            };
        }
    }

    checkUnique(name);

    return {
        start,
        end,
        type: "Attribute",
        name,
        value,
    };
};

/**
 * @param {Parser} parser
 */
const readAttributeValue = (parser) => {
    const quoteMark = parser.eat("'") ? "'" : parser.eat('"') ? '"' : null;

    if (!quoteMark)
        throw parser.error(`Expected quote mark after attribute name`);

    /**
     * @type {Array<import("../types.js").Text | import("../types.js").Expression>}
     */
    const value = [];

    while (!parser.match(quoteMark)) {
        if (parser.eat("{{")) {
            const expression = readExpression(parser.readUntil(/}}/), parser);
            parser.eat("}}", true);
            value.push(expression);
        } else {
            let text = value.at(-1);

            if (text?.type !== "Text") {
                text = {
                    start: parser.index,
                    end: parser.index,
                    type: "Text",
                    data: "",
                };
                value.push(text);
            }

            text.data += parser.template[parser.index++];
            text.end = parser.index;
        }
    }

    parser.eat(quoteMark, true);

    return value;
};
