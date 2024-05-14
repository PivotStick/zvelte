export type Ctx = {
    scope: Record<string, any>[];
    els: Record<string, HTMLElement>;
    bindingGroups?: Record<string, any[]>;
};

export type ComponentInitArgs<
    T,
    Els extends Record<string, HTMLElement> = Record<string, HTMLElement>,
> = {
    props: T;
    els: Els;
    scope: Record<string, any>;
};
