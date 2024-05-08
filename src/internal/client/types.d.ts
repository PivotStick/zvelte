export type Ctx = {
    scope: Record<string, any>[];
    listeners: Record<string, any>;
    els: Record<string, HTMLElement>;
    bindingGroups?: Record<string, any[]>;
};
