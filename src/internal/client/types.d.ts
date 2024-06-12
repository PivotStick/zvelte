export type State = {
    scope: Record<string, any>[];
    els: any;
    bindingGroups: Record<string, any[]>;
    currentNode: Node;
};

export type ComponentInitArgs<
    T,
    Els extends Record<string, HTMLElement | Record<string, any>> = Record<
        string,
        HTMLElement
    >
> = {
    props: T;
    els: Els;
    scope: Record<string, any>;
};
