import { ZvelteNode } from "./phases/1-parse/types.d.ts";
import { Visitors } from "zimmerframe";

export type CompilerOptions = {
    dir: string;

    namespace: string;
    internalsNamespace: string;

    generate: string;
    dev: boolean;
    hmr: boolean;

    filename: string;
    preserveWhitespace: boolean;
    preserveComments: boolean;
    hasJS: boolean;
    css: "injected" | "external";
    async?: {
        endpoint: string;
        propId?: string;
        pendingComponent?: string;
        errorComponent?: string;
    };
    transformers?: {
        ast?: Visitors<ZvelteNode, {}>;
    };
};

export interface ExpressionMetadata {
    /** All the bindings that are referenced inside this expression */
    dependencies: Set<Binding>;
    /** True if the expression references state directly, or _might_ (via member/call expressions) */
    has_state: boolean;
    /** True if the expression involves a call expression (often, it will need to be wrapped in a derived) */
    has_call: boolean;
}
