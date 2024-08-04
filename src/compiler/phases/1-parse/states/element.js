import { parseExpression, parseIdentifier } from "../read/expression.js";
import { createFragment } from "../utils/createFragment.js";
import { isVoid } from "../../../shared/utils/names.js";
import { Parser } from "../index.js";

import readStyle from "../read/style.js";

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

    /**
     * @type {import("#ast").ElementLike["type"]}
     */
    let type = /[A-Z]/.test(name[0])
        ? "Component"
        : name === "title"
        ? "TitleElement"
        : "RegularElement";

    if (name.includes(":")) {
        const [left, right] = name.split(":");
        if (left !== parser.specialTag) {
            throw parser.error(
                `"${left}" must match ${parser.specialTag}`,
                start + 1,
                start + 1 + left.length
            );
        }

        if (right === "component") {
            type = "ZvelteComponent";
        } else if (right === "self") {
            type = "ZvelteSelf";
        } else if (right === "head") {
            type = "ZvelteHead";
        } else {
            throw parser.error(
                `"${right}" unknown ${left} meta tag kind`,
                start + left.length + 2
            );
        }
    }

    parser.allowWhitespace();

    if (isClosingTag) {
        parser.eat(">", true);
        let parent = parser.current();

        // @ts-expect-error
        while (parent.name !== name) {
            if (parent.type !== type) {
                throw parser.error(`"</${name}>" has no opening tag`, start);
            }

            parent.fragment.end = start;
            parent.end = start;
            parser.pop();
            parent = parser.current();
        }

        // @ts-ignore
        parent.fragment.end = start;

        parent.end = parser.index;
        parser.pop();
        return;
    }

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
        fragment: createFragment(true),
    };

    /**
     * @type {import("../types.js").RegularElement["attributes"][number] | null}
     */
    let attribute = null;
    let uniqueNames = new Set();
    while ((attribute = readAttribute(parser, uniqueNames))) {
        // @ts-expect-error
        element.attributes.push(attribute);
        parser.allowWhitespace();
    }

    const selfClosing = parser.eat("/") || isVoid(name);

    parser.eat(">", true);
    element.fragment.start = parser.index;

    if (element.type === "RegularElement") {
        for (const attr of element.attributes) {
            if (attr.type === "BindDirective") {
                const typeAttr =
                    element.name === "input"
                        ? /** @type {import("../types.d.ts").Attribute=} */ (
                              element.attributes.find(
                                  (attr) =>
                                      attr.type === "Attribute" &&
                                      attr.name === "type"
                              )
                          )
                        : undefined;

                let staticTypeAttrValue;

                if (
                    typeAttr &&
                    typeAttr.value !== true &&
                    (typeAttr.value.length !== 1 ||
                        typeAttr.value[0].type !== "Text")
                ) {
                    throw parser.error(
                        "'type' attribute must be a static text value if input uses two-way binding",
                        typeAttr.value[0].start
                    );
                } else if (
                    typeAttr &&
                    typeAttr.value !== true &&
                    typeAttr.value[0].type === "Text"
                ) {
                    staticTypeAttrValue = typeAttr.value[0].data;
                }

                switch (attr.name) {
                    case "value": {
                        if (
                            !["input", "textarea", "select"].includes(
                                element.name
                            )
                        ) {
                            throw parser.error(
                                "`bind:value` can only be used with <input>, <textarea>, <select>",
                                attr.start
                            );
                        }
                        break;
                    }
                    case "group": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:group` can only be used with <input>",
                                attr.start
                            );
                        }
                        break;
                    }
                    case "checked": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:checked` can only be used with <input>",
                                attr.start
                            );
                        }

                        if (staticTypeAttrValue !== "checkbox") {
                            throw parser.error(
                                '`bind:checked` can only be used with <input type="checkbox">',
                                attr.start
                            );
                        }
                        break;
                    }
                    case "files": {
                        if (element.name !== "input") {
                            throw parser.error(
                                "`bind:files` can only be used with <input>",
                                attr.start
                            );
                        }

                        if (staticTypeAttrValue !== "file") {
                            throw parser.error(
                                '`bind:files` can only be used with <input type="file">',
                                attr.start
                            );
                        }
                        break;
                    }
                }
            }
        }
    } else if (element.type === "ZvelteComponent") {
        const thisAttr = /** @type {import("#ast").Attribute=} */ (
            element.attributes.find(
                (attr) => attr.type === "Attribute" && attr.name === "this"
            )
        );
        if (!thisAttr) {
            throw parser.error(
                `\`<${name}>\` must have a 'this' attribute`,
                start
            );
        }

        if (
            thisAttr.value === true ||
            !(thisAttr.value.length === 1 && thisAttr.value[0].type !== "Text")
        ) {
            throw parser.error(
                'Invalid component definition — must be an `"{{ expression }}"`',
                thisAttr.start + thisAttr.name.length + 1
            );
        }

        element.attributes.splice(element.attributes.indexOf(thisAttr), 1);
        element.expression = thisAttr.value[0].expression;
    }

    if (element.type !== "RegularElement") {
        let attr;
        if (
            (attr = element.attributes.find(
                (attr) =>
                    attr.type === "ClassDirective" ||
                    attr.type === "UseDirective" ||
                    attr.type === "TransitionDirective"
            ))
        ) {
            throw parser.error(
                "This type of directive is not valid on components",
                attr.start
            );
        }
    }

    if (element.name === "style") {
        if (parser.root.css)
            throw parser.error(
                "Only one style tag can be declared in a component"
            );

        let start = parser.index;
        let end = start;

        const content = readStyle(parser, start, element.attributes);

        parser.root.css = {
            start,
            end,
            attributes: element.attributes,
            code: content.content.styles,
            ast: content,
        };
    } else {
        parser.append(element);

        if (selfClosing) {
            element.fragment.end = element.end = parser.index;
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
 * @returns {import("../types.js").RegularElement["attributes"][number] | null}
 */
const readAttribute = (parser, uniqueNames) => {
    const start = parser.index;

    /**
     * @param {string} name
     * @param {number} start
     */
    const checkUnique = (name, start) => {
        if (uniqueNames.has(name)) {
            throw parser.error(
                `Duplicate attribute "${name}"`,
                start,
                start + name.length - 1
            );
        }
        uniqueNames.add(name);
    };

    if (parser.eat("{{")) {
        parser.allowWhitespace();

        if (parser.eat("...")) {
            parser.allowWhitespace();
            const expression = parseExpression(parser);

            parser.allowWhitespace();
            parser.eat("}}", true);

            return {
                type: "SpreadAttribute",
                start,
                end: parser.index,
                expression,
            };
        }

        const identifier = parseIdentifier(parser);

        if (!identifier) {
            throw parser.error(
                `"{{ ... }}" expression cannot be used directly inside element's attributes, only in attribute's values. It also can be used like this {{ foo }} as a shortcut for foo="{{ foo }}"`,
                start
            );
        }

        parser.allowWhitespace();
        parser.eat("}}", true);

        return {
            type: "Attribute",
            name: identifier.name,
            doubleQuotes: null,
            value: [
                {
                    type: "ExpressionTag",
                    start,
                    end: parser.index,
                    expression: identifier,
                },
            ],
            start,
            end: parser.index,
        };
    }

    const name = parser.readUntil(regexTokenEndingCharacter);
    const tagBlockMatch = /\{%\s*(\w+)?/.exec(name);

    if (tagBlockMatch) {
        throw parser.error(
            `"{% ${tagBlockMatch[1]} %} blocks cannot be used inside element's attributes"`,
            start
        );
    }

    if (!name) return null;
    let end = parser.index;

    parser.allowWhitespace();

    /**
     * @type {boolean | ReturnType<typeof readAttributeValue>[0]}
     */
    let value = true;
    let doubleQuotes = null;

    if (parser.eat("=")) {
        parser.allowWhitespace();
        [value, doubleQuotes] = readAttributeValue(parser);
        end = parser.index;
    }

    if (name.includes(":")) {
        const directive = attrNameToDirective(name);

        const validate = () => {
            if (value !== true && value.some((n) => n.type === "Text")) {
                throw parser.error(
                    "Directive value must be an expression enclosed in curly braces",
                    value[0].start,
                    value[value.length - 1].end - 1
                );
            }

            const expression =
                value === true
                    ? null
                    : /** @type {import("../types.d.ts").ExpressionTag} */ (
                          value[0]
                      ).expression;

            /** @type {import("../types.d.ts").Identifier} */
            const fallback = {
                type: "Identifier",
                name: directive.name,
                start: start + directive.type.length + 1,
                end,
            };

            return { expression, fallback };
        };

        switch (directive.type) {
            case "on": {
                const { expression } = validate();

                return {
                    type: "OnDirective",
                    start,
                    end,
                    expression,
                    modifiers: directive.modifiers,
                    name: directive.name,
                };
            }

            case "bind": {
                const { expression, fallback } = validate();

                if (directive.name !== "this") {
                    checkUnique(
                        directive.name,
                        start + directive.type.length + 1
                    );
                }

                if (
                    expression &&
                    expression.type !== "Identifier" &&
                    expression.type !== "MemberExpression"
                ) {
                    throw parser.error(
                        "Can only bind to an Identifier or MemberExpression",
                        expression.start,
                        expression.end
                    );
                }

                return {
                    type: "BindDirective",
                    start,
                    end,
                    expression: expression ?? fallback,
                    name: directive.name,
                    modifiers: directive.modifiers,
                };
            }
            case "transition":
            case "in":
            case "out": {
                const { expression } = validate();

                return {
                    type: "TransitionDirective",
                    start,
                    end,
                    expression: expression,
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
                const { expression, fallback } = validate();

                return {
                    type: "ClassDirective",
                    name: directive.name,
                    modifiers: directive.modifiers,
                    expression: expression ?? fallback,
                    start,
                    end,
                };
            }
            case "use": {
                const { expression } = validate();

                return {
                    type: "UseDirective",
                    name: directive.name,
                    modifiers: directive.modifiers,
                    expression,
                    start,
                    end,
                };
            }
        }
    }

    checkUnique(name, start);

    return {
        start,
        end,
        type: "Attribute",
        name,
        value,
        doubleQuotes,
    };
};

/**
 * @param {string} attrName
 */
function attrNameToDirective(attrName) {
    const [left, ...modifiers] = attrName.split("|");
    const [type, name] = left.split(":");

    return {
        type,
        name,
        modifiers,
    };
}

/**
 * @param {Parser} parser
 * @returns {[import("../types.d.ts").Attribute["value"], import("../types.d.ts").Attribute["doubleQuotes"]]}
 */
const readAttributeValue = (parser) => {
    /**
     * @type {import("../types.d.ts").Attribute["doubleQuotes"]}
     */
    let double = false;

    const quoteMark = parser.eat("'")
        ? "'"
        : (double = parser.eat('"'))
        ? '"'
        : null;

    /**
     * @type {import("../types.d.ts").Attribute["value"]}
     */
    const values = [];

    if (quoteMark) {
        while (!parser.match(quoteMark)) {
            if (parser.eat("{{")) {
                const start = parser.index - 2;
                parser.allowWhitespace();
                const expression = parseExpression(parser);
                parser.allowWhitespace();
                parser.eat("}}", true);
                values.push({
                    type: "ExpressionTag",
                    expression,
                    start,
                    end: parser.index,
                });
            } else {
                let text = values.at(-1);

                if (text?.type !== "Text") {
                    text = {
                        start: parser.index,
                        end: parser.index,
                        type: "Text",
                        data: "",
                    };
                    values.push(text);
                }

                text.data += parser.template[parser.index++];
                text.end = parser.index;
            }
        }
    } else {
        double = null;
        if (parser.eat("{{")) {
            const start = parser.index - 2;
            parser.allowWhitespace();
            const expression = parseExpression(parser);
            parser.allowWhitespace();
            parser.eat("}}", true);

            return [
                [
                    {
                        type: "ExpressionTag",
                        expression,
                        start,
                        end: parser.index,
                    },
                ],
                double,
            ];
        }

        const start = parser.index;
        const data = parser.readUntil(/[\s\<\{\>]/);
        const end = parser.index;
        values.push({
            type: "Text",
            start,
            end,
            data,
        });
    }

    if (!values.length) {
        values.push({
            type: "Text",
            start: parser.index,
            end: parser.index,
            data: "",
        });
    }

    if (quoteMark) {
        parser.eat(quoteMark, true);
    }

    return [values, double];
};
