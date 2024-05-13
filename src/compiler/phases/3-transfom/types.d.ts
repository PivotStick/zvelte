import type { Root } from "#ast";

export type Transformer = (
    ast: Root,
    options: { dir: string; namespace: string; filename: string },
    meta: any,
) => {
    code: string;
};
