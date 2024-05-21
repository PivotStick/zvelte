import type { Root } from "#ast";

export type Transformer = (
    ast: Root,
    analysis: ReturnType<
        (typeof import("../2-analyze/index.js"))["analyseComponent"]
    >,
    options: {
        dir: string;
        namespace: string;
        filename: string;
        preserveWhitespace?: boolean;
    },
    meta: any,
) => {
    code: string;
};
