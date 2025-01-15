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
import { AwaitBlock } from "./visitors/AwaitBlock.js";
import { SnippetBlock } from "./visitors/SnippetBlock.js";
import { ForBlock } from "./visitors/ForBlock.js";

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

    let uuid = -1;

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

        unique(key) {
            uuid++;
            if (uuid === 0) {
                return key;
            }

            return key + "_" + uuid;
        },
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
    ForBlock,
    KeyBlock,
    AwaitBlock,
    SnippetBlock,

    RenderTag,
    HtmlTag,

    VariableTag(node, { state, visit }) {
        // - TODO, we need to debate about this feature
        //
        // const assignment = /** @type {any} */ (visit(node.assignment));
        // state.template.push(assignment);
    },

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
};
