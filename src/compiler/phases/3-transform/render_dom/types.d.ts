import type { ZvelteNode } from "#ast";
import type { CompilerOptions } from "../../../types.js";
import type { ComponentAnalysis } from "../../2-analyze/types.js";
import type { Transformer } from "../types.js";
import type { Scope } from "./scope.js";

export type ComponentClientTransformState = {
    readonly scope: Scope;
    readonly scopes: Map<ZvelteNode, Scope>;
    readonly events: Set<string>;
    analysis: ComponentAnalysis;
    options: CompilerOptions;
    hoisted: (
        | import("estree").ImportDeclaration
        | import("estree").VariableDeclaration
        | import("estree").ExpressionStatement
    )[];
    node: any;
    readonly before_init: any[];
    readonly init: any[];
    readonly update: any[];
    readonly after_update: any[];
    readonly template: any[];
    readonly locations: any[];
    legacyReactiveStatements: Map<any, any>;
    metadata: {
        context: {
            template_needs_import_node: boolean;
            template_contains_script_tag: boolean;
        };
        namespace: import("#ast").Namespace;
        bound_contenteditable: boolean;
    };
    nonPropVars: string[];
    nonPropSources: string[];
    nonPropUnwraps: string[];
    nonPropGetters: string[];
    initProps: Set<string>;
    overrides: Record<string, import("estree").Expression>;
    els: boolean;
    ignoreScope: boolean;
    componentId: import("estree").Identifier;

    readonly transform: Record<
        string,
        {
            /** turn `foo` into e.g. `$.get(foo)` */
            read: (
                id: import("estree").Identifier,
            ) => import("estree").Expression;
            /** turn `foo = bar` into e.g. `$.set(foo, bar)` */
            assign?: (
                node: import("estree").Identifier,
                value: import("estree").Expression,
            ) => import("estree").Expression;
            /** turn `foo.bar = baz` into e.g. `$.mutate(foo, $.get(foo).bar = baz);` */
            mutate?: (
                node: import("estree").Identifier,
                mutation: import("estree").AssignmentExpression,
            ) => import("estree").Expression;
            /** turn `foo++` into e.g. `$.update(foo)` */
            update?: (
                node: import("estree").UpdateExpression,
            ) => import("estree").Expression;
        }
    >;
};

export type ComponentContext = import("zimmerframe").Context<
    ZvelteNode,
    ComponentClientTransformState
>;
export type ComponentVisitors = import("zimmerframe").Visitors<
    ZvelteNode,
    ComponentClientTransformState
>;

export type SourceLocation =
    | [line: number, column: number]
    | [line: number, column: number, SourceLocation[]];
