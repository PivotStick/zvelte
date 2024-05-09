export type Ctx = {
    scope: Record<string, any>[];
    els: Record<string, HTMLElement>;
    bindingGroups?: Record<string, any[]>;
};
