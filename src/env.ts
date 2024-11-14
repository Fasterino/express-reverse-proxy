import 'process'

interface EnvFunc {
    (def: number): number
    (def: string): string
}

type EnvFuncGeneric = (def: string | number) => string | number

interface Env {
    readonly [key: string]: EnvFunc
}

export const env: Env = new Proxy<Env>({}, {
    get(_, prop: string, cast): EnvFuncGeneric {
        return def => {
            const val: string = process.env[prop]
            if (!val) return def

            switch (typeof def) {
                case 'number':
                    return Number.isNaN(val) ? def : Number(val)
                default:
                    return val
            }
        }
    }
});