export type Listeners = {
    [x: string]: ((...args: any[]) => void) | Listeners;
};
