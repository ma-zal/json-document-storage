export type JSONData =
    | string
    | number
    | boolean
    | { [x: string]: JSONData }
    | Array<JSONData>;
