import type { Root } from "#ast";

export type Transformer = (
    ast: Root,
    analysis: ReturnType<
        typeof import("../2-analyze/index.js")["analyseComponent"]
    >,
    options: {
        dir: string;
        namespace: string;
        filename: string;
        preserveWhitespace: boolean;
        preserveComments: boolean;
        async?: {
            endpoint: string;
            pendingComponent?: string;
            errorComponent?: string;
        };
        hasJS: boolean;
    },
    meta: {}
) => {
    code: string;
};
