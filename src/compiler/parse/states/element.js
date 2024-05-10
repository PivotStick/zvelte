import { is_void } from "../../shared/utils/names.js";
import { parseExpression } from "../read/expression.js";
import * as csstree from "css-tree";
import { createFragment } from "../utils/createFragment.js";
import { Parser } from "../index.js";
import * as sass from "sass";

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
    let element = {
        start,
        // @ts-expect-error
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
     * @type {import("../types.js").Element["attributes"][number] | null}
     */
    let attribute = null;
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
                `A component must have a '${parser.component?.key}' attribute`,
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
                `"${parser.component?.key}" is expected to have a Text value only on a component`,
                keyAttr.start,
            );
        }

        element.key = keyAttr.value[0];
    }

    if (element.type === "Element") {
        element.attributes.forEach((attr) => {
            if (attr.type === "BindDirective") {
                const typeAttr =
                    /** @type {import("../types.d.ts").Attribute=} */ (
                        element.attributes.find(
                            (attr) =>
                                attr.type === "Attribute" &&
                                attr.name === "type",
                        )
                    );

                if (
                    typeAttr &&
                    typeAttr.value !== true &&
                    typeAttr.value.some((v) => v.type !== "Text")
                ) {
                    throw parser.error(
                        "'type' attribute must be a static text value if input uses two-way binding",
                    );
                }

                switch (attr.name) {
                    case "value":
                        if (
                            !["input", "textarea", "select"].includes(
                                element.name,
                            )
                        ) {
                            throw parser.error(
                                "`bind:value` can only be used with <input>, <textarea>, <select>",
                            );
                        }
                        break;
                    case "group": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:group` can only be used with <input>",
                            );
                        }
                        break;
                    }
                    case "checked": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:checked` can only be used with <input>",
                            );
                        }

                        if (
                            !typeAttr ||
                            typeAttr?.value === true ||
                            (typeAttr?.value[0].type === "Text" &&
                                typeAttr.value[0].data !== "checkbox")
                        ) {
                            throw parser.error(
                                '`bind:checked` can only be used with <input type="checkbox">',
                            );
                        }
                        break;
                    }
                }
            }
        });
    }

    if (element.name === "style") {
        if (parser.root.css)
            throw parser.error(
                "Only one style tag can be declared in a component",
            );

        let code = "";
        let start = parser.index;
        let end = start;

        const isScss = element.attributes.some(
            (attr) =>
                attr.type === "Attribute" &&
                attr.name === "lang" &&
                attr.value !== true &&
                attr.value.length === 1 &&
                attr.value[0].type === "Text" &&
                ["scss", "sass"].includes(attr.value[0].data),
        );

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
                csstree.parse(isScss ? sass.compileString(code).css : code, {
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
 * @returns {import("../types.js").Element["attributes"][number] | null}
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
        const directive = attrNameToDirective(name);

        if (
            value !== true &&
            (value.length !== 1 || value[0].type === "Text")
        ) {
            throw parser.error(
                "Directive value must be an expression enclosed in curly braces",
                start,
            );
        }

        const expression =
            value === true
                ? null
                : /** @type {import("../types.d.ts").Expression} */ (value[0]);

        switch (directive.type) {
            case "on":
                return {
                    type: "OnDirective",
                    start,
                    end,
                    expression,
                    modifiers: directive.modifiers,
                    name: directive.name,
                };

            case "bind": {
                if (
                    expression &&
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
                    name: directive.name,
                    modifiers: directive.modifiers,
                };
            }
            case "transition":
            case "in":
            case "out": {
                return {
                    type: "TransitionDirective",
                    start,
                    end,
                    expression,
                    name: directive.name,
                    modifiers: directive.modifiers,
                    intro:
                        directive.type === "transition" ||
                        directive.type === "in",
                    outro:
                        directive.type === "transition" ||
                        directive.type === "out",
                };
            }
            case "class": {
                return {
                    type: "ClassDirective",
                    name: directive.name,
                    modifiers: directive.modifiers,
                    expression,
                    start,
                    end,
                };
            }
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

const attrNameToDirective = (attrName = "") => {
    const [left, ...modifiers] = attrName.split("|");
    const [type, name] = left.split(":");

    return {
        type,
        name,
        modifiers,
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
            parser.allowWhitespace();
            const expression = parseExpression(parser);
            parser.allowWhitespace();
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
