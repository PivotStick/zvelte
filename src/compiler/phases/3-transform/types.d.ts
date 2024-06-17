import type { Root } from "#ast";
import type { CompilerOptions } from "../../types.js";

export type Transformer = (
    ast: Root,
    analysis: ReturnType<
        typeof import("../2-analyze/index.js")["analyseComponent"]
    >,
    options: CompilerOptions,
    meta: {}
) => {
    code: string;
};
