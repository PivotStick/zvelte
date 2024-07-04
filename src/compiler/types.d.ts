import { ZvelteNode } from "./phases/1-parse/types.d.ts";
import { Visitors } from "zimmerframe";

export type CompilerOptions = {
    dir: string;

    namespace: string;
    internalsNamespace: string;

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
