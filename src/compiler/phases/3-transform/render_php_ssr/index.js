import * as b from "./builders.js";

import { walk } from "zimmerframe";
import { print } from "./print/index.js";

import { RenderTag } from "./visitors/RenderTag.js";
import { Fragment } from "./visitors/Fragment.js";
import { RegularElement } from "./visitors/RegularElement.js";
import { IfBlock } from "./visitors/IfBlock.js";
import { Identifier } from "./visitors/Identifier.js";
import { MemberExpression } from "./visitors/MemberExpression.js";
import { ZvelteHead } from "./visitors/ZvelteHead.js";
import { TitleElement } from "./visitors/TitleElement.js";
import { NullLiteral } from "./visitors/NullLiteral.js";
import { BooleanLiteral } from "./visitors/BooleanLiteral.js";
import { NumericLiteral } from "./visitors/NumericLiteral.js";
import { StringLiteral } from "./visitors/StringLiteral.js";
import { HtmlTag } from "./visitors/HtmlTag.js";
import { Component } from "./visitors/Component.js";
import { BinaryExpression } from "./visitors/BinaryExpression.js";
import { ArrayExpression } from "./visitors/ArrayExpression.js";
import { ObjectExpression } from "./visitors/ObjectExpression.js";
import { CallExpression } from "./visitors/CallExpression.js";
import { FilterExpression } from "./visitors/FilterExpression.js";
import { InExpression } from "./visitors/InExpression.js";
import { IsExpression } from "./visitors/IsExpression.js";
import { RangeExpression } from "./visitors/RangeExpression.js";
import { LogicalExpression } from "./visitors/LogicalExpression.js";
import { UnaryExpression } from "./visitors/UnaryExpression.js";
import { UpdateExpression } from "./visitors/UpdateExpression.js";
import { AssignmentExpression } from "./visitors/AssignmentExpression.js";
import { ArrowFunctionExpression } from "./visitors/ArrowFunctionExpression.js";
import { ZvelteSelf } from "./visitors/ZvelteSelf.js";
import { ZvelteComponent } from "./visitors/ZvelteComponent.js";
import { KeyBlock } from "./visitors/KeyBlock.js";

export const outputName = "payload";
export const propsName = "props";

/**
 * @type {import("../types.js").Transformer}
 */
export function renderPhpSSR(source, ast, analysis, options, meta) {
    const renderMethod = b.method("render", "void");

    renderMethod.isStatic = true;
    renderMethod.arguments.push(
        b.parameter(outputName, "object"),
        b.parameter(propsName, "object"),
    );

    const param = b.parameter(propsName, "object");
    param.nullable = true;
    param.value = b.nullKeyword();

    const componentName = options.filename.replace(/\..*$/, "");

    /**
     * @type {Set<string>}
     */
    const internalImports = new Set();

    /** @type {any[]} */
    const namespace = [];

    /** @type {import("./types.d.ts").ComponentServerTransformState} */
    const state = {
        options,
        analysis,
        isInIsset: false,

        imports: ast.imports,
        skipHydrationBoundaries: false,
        namespace: "html",

        overrides: {},
        template: [],
        init: [],
    };

    ast.imports.forEach((n) => {
        namespace.push(
            b.useitem(n.source.value.replace(/\//g, "\\"), n.specifier.name),
        );
    });

    /** @type {import("./types.d.ts").Block} */
    const block = /** @type {any} */ (walk(ast.fragment, state, visitors));

    renderMethod.body = block;

    const renderer = b.declareClass(componentName, [renderMethod]);

    if (internalImports.size) {
        namespace.push(
            b.use(options.internalsNamespace, ...[...internalImports]),
        );
    }

    namespace.push(renderer);

    const result = print(
        b.program([b.namespace(options.namespace, namespace)]),
    );

    return result;
}

/**
 * @type {import("zimmerframe").Visitors<import("#ast").ZvelteNode, import("./types.js").ComponentServerTransformState>}
 */
const visitors = {
    _(node, { next, state }) {
        if (!(node.type in visitors)) {
            const s = b.string(`[ ${node.type} ]`);
            state.template.push(s);
        } else {
            next();
        }
    },

    Fragment,
    RegularElement,
    Component,

    IfBlock,
    KeyBlock,

    RenderTag,
    HtmlTag,

    ZvelteHead,
    ZvelteSelf,
    ZvelteComponent,
    TitleElement,

    Identifier,
    MemberExpression,

    ArrayExpression,
    ObjectExpression,
    ArrowFunctionExpression,

    CallExpression,
    FilterExpression,

    InExpression,
    IsExpression,
    RangeExpression,
    UnaryExpression,
    UpdateExpression,
    AssignmentExpression,

    BinaryExpression,
    LogicalExpression,

    NullLiteral,
    BooleanLiteral,
    NumericLiteral,
    StringLiteral,

    // ForBlock(node, { state, path, visit }) {
    //     state.appendText(BLOCK_OPEN);
    //
    //     const hasParent = path.some((n) => n.type === "ForBlock");
    //
    //     const source = /** @type {any} */ (visit(node.expression));
    //     const index = b.variable("i");
    //     const value = b.variable(node.context.name);
    //     const key = node.index ? b.variable(node.index.name) : undefined;
    //
    //     const forEach = b.forEach(source, value, key);
    //
    //     const nonPropVars = ["loop", value.name];
    //
    //     if (key) {
    //         nonPropVars.push(key.name);
    //     }
    //
    //     if (hasParent) {
    //         state.block.children.push(
    //             b.assign(b.variable("parent"), "=", b.variable("loop")),
    //         );
    //     }
    //
    //     const forEachState = createState(state, forEach.body);
    //     const length = b.variable("length");
    //
    //     state.block.children.push(b.assign(index, "=", b.number(0)));
    //     forEachState.block.children.push(
    //         b.assign(
    //             length,
    //             "=",
    //             b.call(b.id("count"), [b.cast(source, "array")]),
    //         ),
    //     );
    //
    //     if (node.fallback) {
    //         const ifBlock = b.ifStatement(
    //             b.unary("!", state.internal("testEmpty", source)),
    //         );
    //         ifBlock.alternate = b.block();
    //
    //         const ifState = createState(state, ifBlock.body);
    //         const fallbackState = createState(state, ifBlock.alternate);
    //
    //         ifBlock.body.children.push(forEach);
    //         state.block.children.push(ifBlock);
    //
    //         visit(node.fallback, fallbackState);
    //         ifState.appendText(BLOCK_CLOSE);
    //         fallbackState.appendText(BLOCK_OPEN_ELSE);
    //     } else {
    //         state.block.children.push(forEach);
    //         state.appendText(BLOCK_CLOSE);
    //     }
    //
    //     forEach.body.children.push(
    //         b.assign(
    //             b.variable("loop"),
    //             "=",
    //             b.object(
    //                 new Map(
    //                     /** @type {[any, any][]} */ ([
    //                         [b.string("index0"), index],
    //                         [b.string("index"), b.bin(index, "+", b.number(1))],
    //                         [
    //                             b.string("revindex0"),
    //                             b.bin(
    //                                 b.bin(length, "-", index),
    //                                 "-",
    //                                 b.number(1),
    //                             ),
    //                         ],
    //                         [b.string("revindex"), b.bin(length, "-", index)],
    //                         [
    //                             b.string("first"),
    //                             b.bin(index, "===", b.number(0)),
    //                         ],
    //                         [
    //                             b.string("last"),
    //                             b.bin(
    //                                 index,
    //                                 "===",
    //                                 b.bin(length, "-", b.number(1)),
    //                             ),
    //                         ],
    //                         [b.string("length"), length],
    //                         [
    //                             b.string("parent"),
    //                             hasParent
    //                                 ? b.variable("parent")
    //                                 : b.nullKeyword(),
    //                         ],
    //                     ]),
    //                 ),
    //             ),
    //         ),
    //     );
    //
    //     forEachState.nonPropVars = [
    //         ...forEachState.nonPropVars,
    //         ...nonPropVars,
    //     ];
    //
    //     visit(node.body, forEachState);
    //
    //     forEach.body.children.push(b.assign(index, "+=", b.number(1)));
    // }
    // AwaitBlock(node, { state, visit }) {
    //     state.appendText(BLOCK_OPEN);
    //     if (node.pending) {
    //         visit(node.pending);
    //     }
    //     state.appendText(BLOCK_CLOSE);
    // }
    // SnippetBlock(node, context) {
    //     const fn = createSnippetClosure(context, node.parameters, node.body);
    //
    //     context.state.block.children.push(
    //         b.assign(
    //             b.propertyLookup(
    //                 b.variable(propsName),
    //                 b.id(node.expression.name),
    //             ),
    //             "=",
    //             fn,
    //         ),
    //     );
    // }
    // VariableTag(node, { state, visit }) {
    //     const assignment = /** @type {any} */ (visit(node.assignment));
    //     state.block.children.push(assignment);
    // }
};
