import type { ZvelteNode } from "#ast";
import type { CompilerOptions } from "../../../types.js";
import type { Transformer } from "../types.js";
import type { Scope } from "./scope.js";

export type ComponentClientTransformState = {
    readonly scope: Scope;
    readonly scopes: Map<ZvelteNode, Scope>;
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
    overrides: Record<string, import("estree").Expression>;
    els: boolean;
    ignoreScope: boolean;
    componentId: import("estree").Identifier;
};

export type ComponentContext = import("zimmerframe").Context<
    ZvelteNode,
    ComponentClientTransformState
>;
export type ComponentVisitors = import("zimmerframe").Visitors<
    ZvelteNode,
    ComponentClientTransformState
>;
