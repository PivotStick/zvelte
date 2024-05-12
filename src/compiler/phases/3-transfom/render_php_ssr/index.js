import { isVoid } from "../../../shared/utils/names.js";
import * as b from "./builders.js";
import { print } from "./print/index.js";

const outputName = "html";
const propsName = "props";

/**
 * @param {import("#ast").Root} ast
 * @param {{ namespace: string; dir: string; filename: string; }} options
 * @param {*} meta
 */
export function renderPhpSSR(ast, options, meta) {
    const renderMethod = b.method("render", "string");

    renderMethod.isStatic = true;
    renderMethod.arguments.push(
        b.parameter(propsName, "object"),
        b.parameter("slots", "array"),
        b.parameter("render", "callable"),
    );

    renderBlock(renderMethod.body, ast.fragment, [], {
        namespace: options.namespace,
    });

    const renderer = b.declareClass(options.filename.replace(/\..*$/, ""), [
        renderMethod,
    ]);
    const result = print(
        b.program([
            b.namespace(options.namespace + options.dir.replace(/\//g, "\\"), [
                renderer,
            ]),
        ]),
    );

    return result;
}

/**
 * @param {import("./type.js").Block} block
 * @param {import("#ast").Fragment} node
 * @param {string[][]} scope
 * @param {{ namespace: string; }} meta
 */
function renderBlock(block, node, scope, meta) {
    const outputValue = b.array([]);
    const outputAssign = b.assign(b.variable(outputName), "=", outputValue);

    block.children.push(outputAssign);

    handle(node, createCtx(block), false, scope, meta);

    let returned;

    const implode = (/** @type {import("./type.js").Expression} */ expr) =>
        b.call(b.name("implode"), [b.literal(""), expr]);

    const last = block.children.at(-1);
    if (
        last?.kind === "expressionstatement" &&
        last.expression.kind === "assign" &&
        last.expression.left.kind === "variable" &&
        last.expression.left.name === outputName &&
        last.expression.operator === "=" &&
        last.expression.right === outputValue
    ) {
        block.children.pop();

        if (outputValue.items.length <= 1) {
            returned = outputValue.items[0]?.value ?? b.string("");
        } else {
            returned = implode(outputAssign.expression.right);
        }
    } else {
        returned = implode(outputAssign.expression.left);
    }

    block.children.push(b.returnExpression(returned));
}

/**
 * @param {import("./type.js").Block} block
 *
 * @returns {Ctx}
 */
function createCtx(block) {
    return {
        block,
        append(value) {
            const previous = block.children.at(-1);

            if (
                value.kind === "string" &&
                previous?.kind === "expressionstatement" &&
                previous.expression.kind === "assign" &&
                previous.expression.left.kind === "offsetlookup" &&
                previous.expression.left.what.kind === "variable" &&
                previous.expression.left.what.name === outputName &&
                previous.expression.operator === "=" &&
                previous.expression.right.kind === "string"
            ) {
                previous.expression.right.value += value.value;
                previous.expression.right.raw = `'${previous.expression.right.value}'`;
            } else if (
                previous?.kind === "expressionstatement" &&
                previous.expression.kind === "assign" &&
                previous.expression.left.kind === "variable" &&
                previous.expression.left.name === outputName &&
                previous.expression.operator === "=" &&
                previous.expression.right.kind === "array"
            ) {
                const last = previous.expression.right.items.at(-1);

                if (last?.value.kind === "string" && value.kind === "string") {
                    last.value.value += value.value;
                    last.value.raw = `'${last.value.value}'`;
                } else {
                    previous.expression.right.items.push(b.entry(value));
                }
            } else {
                block.children.push(
                    b.assign(
                        b.offsetLookup(b.variable(outputName)),
                        "=",
                        value,
                    ),
                );
            }
        },
        appendText(value) {
            this.append(b.string(value));
        },
    };
}

/**
 * @typedef {{
 *  append(value: import("./type.js").Assign["right"]): void;
 *  appendText(value: string): void;
 *  block: import("./type.js").Block;
 * }} Ctx
 *
 * @param {Exclude<import("#ast").Any, import("#ast").Expression>} node
 * @param {Ctx} ctx
 * @param {boolean} deep
 * @param {string[][]} scope
 * @param {{ namespace: string }} meta
 */
function handle(node, ctx, deep, scope, meta) {
    switch (node.type) {
        case "Comment":
            // ignore for ssr
            break;

        case "Fragment":
            node.nodes.forEach((fragment) =>
                handle(fragment, ctx, deep, scope, meta),
            );
            break;

        case "Element": {
            ctx.appendText(`<${node.name}`);

            node.attributes.forEach((attr) => {
                switch (attr.type) {
                    case "Attribute":
                        if (
                            attr.name === "class" &&
                            node.attributes.find(
                                (a) => a.type === "ClassDirective",
                            )
                        ) {
                            break;
                        }

                        if (attr.values === true) {
                            ctx.appendText(` ${attr.name}`);
                        } else if (
                            attr.values.length === 1 &&
                            attr.values[0].type === "Text"
                        ) {
                            ctx.appendText(
                                ` ${attr.name}="${attr.values[0].data}"`,
                            );
                        } else {
                            ctx.appendText(` ${attr.name}="`);
                            ctx.append(
                                computeAttrValue(attr, ctx, deep, scope),
                            );
                            ctx.appendText('"');
                        }
                        break;

                    case "ClassDirective": {
                        // If this class directive is not the first skip
                        // It's because the it's the first found class directive that handles everything
                        if (
                            node.attributes.find(
                                (a) => a.type === "ClassDirective",
                            ) !== attr
                        )
                            break;

                        ctx.appendText(` class="`);

                        const attrs =
                            /** @type {import("#ast").Attribute[]} */ (
                                node.attributes.filter(
                                    (a) =>
                                        a.type === "Attribute" &&
                                        a.name === "class",
                                )
                            );

                        attrs.forEach((a) => {
                            if (a.values === true) return;

                            const last = a.values[a.values.length - 1];
                            if (last.type === "Text") {
                                last.data += " ";
                            } else {
                                a.values.push({
                                    type: "Text",
                                    data: " ",
                                    end: -1,
                                    start: -1,
                                });
                            }

                            ctx.append(computeAttrValue(a, ctx, deep, scope));
                        });

                        const classDirectives =
                            /** @type {import("#ast").ClassDirective[]} */ (
                                node.attributes.filter(
                                    (a) => a.type === "ClassDirective",
                                )
                            );

                        const array = b.array();

                        classDirectives.forEach((a) => {
                            const test = expression(
                                a.expression ?? {
                                    type: "Identifier",
                                    name: a.name,
                                    start: -1,
                                    end: -1,
                                },
                                ctx,
                                deep,
                                scope,
                            );

                            array.items.push(
                                b.entry(
                                    b.ternary(
                                        test,
                                        b.string(a.name),
                                        b.string(""),
                                    ),
                                ),
                            );
                        });

                        ctx.append(
                            b.call(b.name("implode"), [
                                b.string(" "),
                                b.call(b.name("array_filter"), [
                                    array,
                                    b.string("boolval"),
                                ]),
                            ]),
                        );

                        ctx.appendText(`"`);
                        break;
                    }

                    case "BindDirective": {
                        const ex = attr.expression ?? {
                            type: "Identifier",
                            name: attr.name,
                            start: -1,
                            end: -1,
                        };

                        const value = b.variable("attrValue");

                        ctx.block.children.push(
                            b.assign(
                                value,
                                "=",
                                expression(ex, ctx, deep, scope),
                            ),
                        );

                        const test = b.bin(value, "==", b.nullKeyword());

                        ctx.append(
                            b.ternary(
                                test,
                                b.sprintf([`${attr.name}="`, value, '"']),
                                b.string(""),
                            ),
                        );
                        break;
                    }

                    case "OnDirective":
                    case "TransitionDirective":
                        // do nothing
                        break;

                    default:
                        throw new Error(
                            // @ts-expect-error
                            `Unhandled "${attr.type}" on element php render`,
                        );
                }
            });

            if (isVoid(node.name)) {
                ctx.appendText("/>");
            } else {
                ctx.appendText(">");
                handle(node.fragment, ctx, deep, scope, meta);
                ctx.appendText(`</${node.name}>`);
            }
            break;
        }

        case "Text": {
            ctx.appendText(node.data);
            break;
        }

        case "ExpressionTag": {
            const ex = expression(node.expression, ctx, deep, scope);
            ctx.append(ex);
            break;
        }

        case "Variable": {
            const left = expression(node.name, ctx, deep, scope);
            const right = expression(node.value, ctx, deep, scope);

            ctx.block.children.push(b.assign(left, "=", right));
            break;
        }

        case "IfBlock": {
            const ifBlock = b.ifStatement(
                expression(node.test, ctx, deep, scope),
            );

            ctx.appendText("<!--[-->");

            const bodyCtx = createCtx(ifBlock.body);
            handle(node.consequent, bodyCtx, deep, [...scope, []], meta);
            bodyCtx.appendText("<!--]-->");

            ifBlock.alternate = b.block();
            const elseCtx = createCtx(ifBlock.alternate);

            if (node.alternate) {
                handle(node.alternate, elseCtx, deep, [...scope, []], meta);
            }

            elseCtx.appendText("<!--]!-->");

            ctx.block.children.push(ifBlock);
            break;
        }

        case "ForBlock": {
            const arrayVar = b.variable("forArray");
            const indexVar = b.variable("index");
            const lengthVar = b.variable("arrayLength");
            const loopParentVar = b.variable("loopParent");
            const loopVar = b.variable("loop");

            ctx.block.children.push(
                b.assign(
                    arrayVar,
                    "=",
                    expression(node.expression, ctx, deep, scope),
                ),
            );

            ctx.block.children.push(
                b.assign(lengthVar, "=", b.call(b.name("count"), [arrayVar])),
            );

            ctx.block.children.push(b.assign(loopParentVar, "=", loopVar));

            ctx.appendText("<!--[-->");

            const ifBlock = node.fallback
                ? b.ifStatement(b.unary("!", b.empty(arrayVar)))
                : null;

            if (ifBlock && node.fallback) {
                ifBlock.alternate = b.block();
                const alternateCtx = createCtx(ifBlock.alternate);
                handle(node.fallback, alternateCtx, deep, [...scope, []], meta);
                alternateCtx.appendText("<!--]!-->");
            }

            let targetCtx = ifBlock ? createCtx(ifBlock.body) : ctx;

            const forEach = b.forEach(
                arrayVar,
                b.variable(node.context.name),
                indexVar,
            );

            const forEachCtx = createCtx(forEach.body);

            const loopObject = b.objectFromLiteral({
                index: b.bin(indexVar, "+", b.number(1)),
                index0: indexVar,
                revindex: b.bin(lengthVar, "-", indexVar),
                revindex0: b.bin(
                    lengthVar,
                    "-",
                    b.bin(indexVar, "-", b.number(1)),
                ),
                first: b.bin(indexVar, "===", b.number(0)),
                last: b.bin(
                    indexVar,
                    "===",
                    b.bin(lengthVar, "-", b.number(1)),
                ),
                length: lengthVar,
                parent: loopParentVar,
            });

            forEachCtx.block.children.push(b.assign(loopVar, "=", loopObject));

            forEachCtx.appendText("<!--[-->");

            handle(
                node.body,
                forEachCtx,
                deep,
                [...scope, [node.context.name, loopVar.name]],
                meta,
            );

            forEachCtx.appendText("<!--]-->");

            targetCtx.block.children.push(forEach);
            targetCtx.appendText("<!--]-->");

            if (ifBlock) {
                ctx.block.children.push(ifBlock);
            }
            break;
        }

        case "Component": {
            const callee = b.variable("render");

            /**
             * @type {Record<string, import("./type.js").Expression>}
             */
            const props = {};

            node.attributes.forEach((attr) => {
                switch (attr.type) {
                    case "Attribute":
                        props[attr.name] = computeAttrValue(
                            attr,
                            ctx,
                            deep,
                            scope,
                        );
                        break;

                    case "BindDirective": {
                        const ex = attr.expression ?? {
                            type: "Identifier",
                            name: attr.name,
                            start: -1,
                            end: -1,
                        };

                        props[attr.name] = expression(ex, ctx, deep, scope);
                        break;
                    }

                    case "TransitionDirective":
                    case "OnDirective": {
                        // ignore for ssr
                        break;
                    }

                    default:
                        throw new Error(
                            `Unhandled "${attr.type}" on component php render`,
                        );
                }
            });

            /**
             * @type {Record<string, import("./type.js").Expression>}
             */
            const slots = {};

            if (node.fragment.nodes.length) {
                const uniqueVars = [...new Set(scope.flatMap((vars) => vars))];

                const slotProps = "slotProps";

                slots.default = b.closure(
                    true,
                    [b.parameter(slotProps, "object")],

                    [
                        b.variable(propsName),
                        ...uniqueVars.map((name) => b.variable(name)),
                    ],
                    "string",
                );

                slots.default.body.children.push(
                    b.assign(
                        b.variable(propsName),
                        "=",
                        b.array([
                            b.entry(b.variable(propsName), undefined, true),
                            b.entry(b.variable(slotProps), undefined, true),
                        ]),
                    ),
                );

                renderBlock(slots.default.body, node.fragment, scope, meta);
            }

            const render = b.call(callee, [
                b.string(
                    "\\" + meta.namespace + node.key.data.replace(/\//g, "\\"),
                ),
                b.objectFromLiteral(props),
                b.arrayFromObject(slots),
            ]);

            ctx.append(render);
            break;
        }

        case "SlotElement": {
            const props = new Map();

            node.attributes.forEach((attr) => {
                switch (attr.type) {
                    case "Attribute":
                        const key = b.string(attr.name);
                        let value;

                        if (attr.values === true) {
                            value = b.boolean(true);
                        } else if (
                            attr.values.length === 1 &&
                            attr.values[0].type === "Text"
                        ) {
                            value = b.string(attr.values[0].data);
                        } else {
                            value = computeAttrValue(attr, ctx, deep, scope);
                        }

                        props.set(key, value);
                        break;

                    default:
                        throw new Error(
                            `Unhandled "${attr.type}" on slot element php render`,
                        );
                }
            });

            ctx.appendText(`<!--[-->`);
            ctx.append(
                b.call(
                    b.offsetLookup(b.variable("slots"), b.string("default")),
                    [b.object(props)],
                ),
            );
            ctx.appendText(`<!--]-->`);
            break;
        }

        default:
            throw new Error(`"${node.type}" not handled in php renderer`);
    }
}

/**
 * @param {import("#ast").Expression} node
 * @param {Ctx} ctx
 * @param {boolean} deep
 * @param {string[][]} scope
 *
 * @returns {import("./type.js").Expression}
 */
function expression(node, ctx, deep, scope) {
    switch (node.type) {
        case "MemberExpression": {
            const what = expression(node.object, ctx, deep, scope);

            let offset;
            if (node.computed === true) {
                const ex = expression(node.property, ctx, deep, scope);
                offset = b.encapsedPart(ex);
            } else {
                offset = expression(node.property, ctx, true, scope);
                if (offset.kind !== "identifier") {
                    throw new Error("expected identifier");
                }
            }

            return b.propertyLookup(what, offset);
        }

        case "BinaryExpression": {
            const left = expression(node.left, ctx, deep, scope);
            const right = expression(node.right, ctx, deep, scope);

            /** @type {string} */
            let operator = node.operator;

            switch (node.operator) {
                case "~":
                    operator = ".";
                    break;

                case "or":
                    operator = "||";
                    break;

                case "and":
                    operator = "&&";
                    break;
            }

            return b.bin(left, operator, right);
        }

        case "Identifier": {
            const identifier = b.identifier(node.name);

            if (
                deep === false &&
                scope.flatMap((vars) => vars).includes(node.name)
            ) {
                return b.variable(node.name);
            } else if (deep === false) {
                return b.propertyLookup(b.variable(propsName), identifier);
            }

            return identifier;
        }

        case "StringLiteral": {
            return b.string(node.value);
        }

        case "NullLiteral": {
            return b.nullKeyword();
        }

        case "NumericLiteral": {
            return b.number(node.value);
        }

        case "BooleanLiteral": {
            return b.boolean(node.value);
        }

        case "ObjectExpression": {
            /**
             * @type {Parameters<typeof b["object"]>[0]}
             */
            const map = new Map();

            node.properties.forEach((prop) => {
                const key = b.string(
                    prop.key.type === "StringLiteral"
                        ? prop.key.value
                        : prop.key.name,
                );
                map.set(key, expression(prop.value, ctx, deep, scope));
            });

            return b.object(map);
        }

        case "ArrayExpression": {
            /**
             * @type {import("./type.js").Entry[]}
             */
            const entries = [];

            node.elements.forEach((element) => {
                entries.push(b.entry(expression(element, ctx, deep, scope)));
            });

            return b.array(entries);
        }

        case "CallExpression": {
            /** @type {import("./type.js").Expression[]} */
            const args = [];
            const what = expression(node.name, ctx, deep, scope);

            node.arguments.forEach((arg) => {
                args.push(expression(arg, ctx, deep, scope));
            });

            return b.call(what, args, true);
        }

        case "FilterExpression": {
            ctx.block.children.push(
                b.statement(
                    b.call(b.name("print_r"), [
                        b.string(
                            "[WARNING] - FilterExpression are not handled yet but not ignored for testing pruposes",
                        ),
                    ]),
                ),
            );
            return b.nullKeyword();
        }

        case "UnaryExpression": {
            const what = expression(node.argument, ctx, deep, scope);

            switch (node.operator) {
                case "not":
                    return b.unary("!", what);

                case "+":
                case "-":
                    return b.unary(node.operator, what);

                default:
                    throw new Error(
                        // @ts-expect-error
                        `"${node.operator}" unary operator not handled in php renderer`,
                    );
            }
        }

        case "ConditionalExpression": {
            const test = expression(node.test, ctx, deep, scope);
            const consequent = expression(node.consequent, ctx, deep, scope);
            const alternate = expression(node.alternate, ctx, deep, scope);

            return b.ternary(test, consequent, alternate);
        }

        case "RangeExpression": {
            return b.call(b.name("range"), [
                expression(node.from, ctx, deep, scope),
                expression(node.to, ctx, deep, scope),
                b.number(node.step),
            ]);
        }

        default:
            throw new Error(
                // @ts-expect-error
                `"${node.type}" expression not handled in php renderer`,
            );
    }
}

/**
 * @param {import("#ast").Attribute} attr
 * @param {Ctx} ctx
 * @param {boolean} deep
 * @param {string[][]} scope
 */
function computeAttrValue(attr, ctx, deep, scope) {
    if (attr.values === true) return b.boolean(true);

    if (attr.values.length === 1) {
        if (attr.values[0].type !== "Text") {
            const ex = attr.values[0];
            return expression(ex, ctx, deep, scope);
        } else {
            return b.string(attr.values[0].data);
        }
    }

    const template = attr.values.map((val) => {
        if (val.type === "Text") {
            return val.data;
        } else {
            return expression(val, ctx, deep, scope);
        }
    });

    return b.sprintf(template);
}
