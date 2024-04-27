export type Me<T> = {
    getData(): T;
    render(newProps?: Partial<T>): void;
};

export type CompilerOptions = {
    zonePath?: string;
    generate?: "dom" | "php_ssr";
    hydratable?: boolean;
    componentName?: string;
};

export type CompilerRenderer = (
    ast: any,
    options: CompilerOptions,
    meta?: { js?: string },
) => {
    code: string;
    map: any;
};

declare module "@pivotass/zvelte/compiler" {
    export function compile(
        source: string,
        options?: CompilerOptions,
        meta?: { js?: string },
    ): {
        code: string;
        map: any;
    };
}

declare module "@pivotass/zvelte/reactivity" {
    export function proxy<T>(object: T): T;
    export function source<T>(value: T): { value: T };
    export function effect(fn: () => void): void;
    export function derived<Value>(fn: () => Value): Value;

    /**
     * Allows you to conditionally render reactive element from
     * reactive conditions!
     */
    export function ifBlock(
        anchor: Comment,
        conditions: () => boolean,
        consequentRender: () => DocumentFragment,
        alternateRender?: () => DocumentFragment,
    ): void;

    /**
     * This lets you sync a reactive array with a list of dom elements!
     */
    export function forBlock<T>(
        anchor: Comment,
        get: () => T[],
        render: (item: T, array: T[], index: () => number) => DocumentFragment,
        emptyRender?: () => DocumentFragment,
    ): void;

    export function template(content: string): [
        DocumentFragment,
        {
            next<T = typeof Node>(
                walkCount?: number,
                type?: T,
            ): InstanceType<T>;
        },
    ];
}

declare module "@pivotass/zvelte/parser" {
    export function parse(template: string): {
        html: FragmentRoot;
        js: any;
        css: any;
    };

    export type Fragment = Element | Text | MustacheTag | IfBlock | ForBlock;

    export type IfBlock = {
        type: "IfBlock";
        children: Fragment[];
        elseif: boolean;
        expression: Expression;
        else?: ElseBlock<"if">;
    };

    export type ForBlock = {
        type: "ForBlock";
        keyVar: null;
        itemVar: string;
        expression: Expression;
        children: Fragment[];
        else?: ElseBlock<"for">;
    };

    export type ElseBlock<In extends "if" | "for" = "if" | "for"> = {
        type: "ElseBlock";
        in: In;
        children: Fragment[];
    };

    export type MustacheTag = {
        type: "MustacheTag";
        expression: Expression;
    };

    export type FragmentRoot = {
        type: "Fragment";
        children: Fragment[];
    };

    export type Element = {
        type: "Element";
        attributes: Attribute[];
        children: Fragment[];
        name: string;
    };

    export type Attribute = {
        type: "Attribute";
        modifier: null | string;
        name: string;
        value: (Text | Expression)[];
        start: number;
        end: number;
    };

    export type Expression =
        | ConditionalExpression
        | Identifier
        | UnaryExpression
        | BinaryExpression
        | StringLiteral
        | BooleanLiteral
        | NullLiteral
        | NumericLiteral
        | MemberExpression
        | FilterExpression
        | CallExpression;

    export type CallExpression = {
        type: "CallExpression";
        name: Identifier | MemberExpression;
        arguments: Expression[];
    };

    export type FilterExpression = {
        type: "FilterExpression";
        name: Identifier | MemberExpression;
        arguments: Expression[];
    };

    export type MemberExpression = {
        type: "MemberExpression";
        computed: boolean;
        object: Identifier | MemberExpression;
        property: Identifier | MemberExpression;
    };

    export type NumericLiteral = {
        type: "NumericLiteral";
        value: number;
    };

    export type BooleanLiteral = {
        type: "BooleanLiteral";
        value: boolean;
        raw: string;
    };

    export type NullLiteral = {
        type: "NullLiteral";
        value: null;
        raw: string;
    };

    export type StringLiteral = {
        type: "StringLiteral";
        value: string;
        raw: string;
    };

    export type BinaryExpression = {
        type: "BinaryExpression";
        left: Expression;
        operator: string;
        right: Expression;
    };

    export type Identifier = {
        type: "Identifier";
        name: string;
    };

    export type UnaryExpression = {
        type: "UnaryExpression";
        operator: string;
        argument: Expression;
    };

    export type ConditionalExpression = {
        type: "ConditionalExpression";
        test: Expression;
        consequent: Expression;
        alternate: Expression;
    };

    export type Text = {
        type: "Text";
        data: string;
    };

    export type Variable = {
        type: "Variable";
        name: Identifier | MemberExpression;
        value: Expression;
    };
}
