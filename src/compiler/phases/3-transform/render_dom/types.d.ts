import type { ZvelteNode } from "#ast";
import type { Transformer } from "../types.js";
import type { Scope } from "./scope.js";

export type ComponentClientTransformState = {
    readonly scope: Scope;
    readonly scopes: Map<ZvelteNode, Scope>;
    options: Parameters<Transformer>[2];
    hoisted: import("estree").ImportDeclaration[];
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
        namespace: string;
        bound_contenteditable: boolean;
    };
    events: Set<any>;
    preserve_whitespace: boolean | undefined;
    public_state: Map<any, any>;
    private_state: Map<any, any>;
    in_constructor: boolean;
    nonPropVars: string[];
    nonPropSources: string[];
    nonPropGetters: string[];
};

export type ComponentContext = import("zimmerframe").Context<
    ZvelteNode,
    ComponentClientTransformState
>;
export type ComponentVisitors = import("zimmerframe").Visitors<
    ZvelteNode,
    ComponentClientTransformState
>;
