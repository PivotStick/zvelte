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

declare module "@pivotass/zvelte/reactivity" {}

declare module "@pivotass/zvelte/parser" {
    export function parse(template: string): {
        html: {
            type: string;
            children: any[];
        };
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
    };

    export type Expression =
        | ConditionalExpression
        | Identifier
        | UnaryExpression
        | BinaryExpression
        | StringLiteral;

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
        name: string;
        value: Expression;
    };
}
