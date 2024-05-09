export type Ctx = {
    scope: Record<string, any>[];
    els: Record<string, HTMLElement>;
    bindingGroups?: Record<string, any[]>;
};

export type ComponentInit<T> = (args: {
    props: T;
    els: Ctx["els"];
    scope: Record<string, any>;
}) => any;
