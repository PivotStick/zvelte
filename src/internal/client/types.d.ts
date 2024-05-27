export type Ctx = {
    scope: Record<string, any>[];
    els: Record<string, HTMLElement | Record<string, any>>;
    bindingGroups: Record<string, any[]>;
};

export type ComponentInitArgs<
    T,
    Els extends Record<string, HTMLElement | Record<string, any>> = Record<
        string,
        HTMLElement
    >,
> = {
    props: T;
    els: Els;
    scope: Record<string, any>;
};
