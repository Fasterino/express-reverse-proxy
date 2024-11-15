import { readFile, writeFile } from "fs/promises"
import { join, resolve } from 'path'

interface Dict<T> {
    [key: string]: T
}

type Cors = string[] | '*'
type Nullable<T> = T | null

type DomainCertName = string

export const CERT_NAME = 'cert-name'


export class Config implements IConfig {
    volumePath: string
    domains: Dict<ConfigAtDomain>

    constructor(cfg: IConfig, volumePath: string) {
        this.volumePath = volumePath

        for (const key of Object.keys(cfg))
            this[key] = cfg[key]
    }

    static getDefault(): IConfig {
        return {
            domains: {
                "test.com": {
                    [CERT_NAME]: "test.com",
                    "/": {
                        domain: "web-docker-container",
                        port: 8080
                    },
                    "/api/": {
                        domain: "api-docker-container",
                        port: 8081,
                        cors: ["test.com"],
                        relative: true
                    },
                },
                "mirror.test.com": {
                    [CERT_NAME]: "test.com",
                    "/": {
                        domain: "test.cc",
                        https: true,
                        cors: '*',
                        rewriteDomain: true
                    }
                },
                "static.test.com": {
                    [CERT_NAME]: "test.com",
                    "/": {
                        folder: "volFolder",
                        cors: '*'
                    },
                    "/extra/": {
                        folder: "extraVolFolder",
                        cors: ['test.com', 'test.cc'],
                        relative: true
                    }
                }
            }
        }
    }

    static async save(cfg: IConfig, volumePath: string) {
        await writeFile(Config.configPath(volumePath), JSON.stringify(cfg, undefined, 2))
        return cfg
    }

    static async load(volumePath: string) {
        return new Config(
            await readFile(Config.configPath(volumePath), 'utf8')
                .then(
                    res => JSON.parse(res) as IConfig,
                    async err => await Config.save(Config.getDefault(), volumePath)
                ),
            volumePath
        )
    }

    static isStatic(atPath: ConfigAtPathRaw): atPath is ConfigAtPathStatic {
        return "folder" in atPath
    }

    private static configPath(volumePath: string) { return join(resolve(volumePath), 'config.json') }
    private static fixPath(path: string) { return (path.startsWith('/') ? '' : '/') + path + (!path.length || path.endsWith('/') ? '' : '/') }
    private static splitPath(path: string) {
        const fixedPath = Config.fixPath(path)
        return fixedPath.length < 2 ? [] : fixedPath.substring(1, fixedPath.length - 1).split('/')
    }

    repr(): IConfig {
        return {
            domains: this.domains,
        }
    }

    getCerts(): Dict<Nullable<DomainCertName>> {
        return Object.fromEntries(
            Object.entries(this.domains)
                .map(([key, val]) =>
                    [
                        key,
                        typeof val[CERT_NAME] == 'string' ? val[CERT_NAME] : null
                    ])
        )
    }

    getProxyData(domain: string, path: string): Nullable<ConfigAtPath> {
        const atDomain = this.domains[domain]
        if (!atDomain)
            return null

        const [atPath, exclude] = this.getConfigFromDomain(atDomain, path)
        if (!atPath)
            return null
        if (Config.isStatic(atPath))
            return {
                exclude,
                folder: atPath.folder,
                cors: atPath.cors || [domain],
                relative: atPath.relative
            }
        return {
            exclude,
            domain: atPath.domain,
            port: atPath.port || 0,
            headers: atPath.headers || {},
            https: atPath.https,
            cors: atPath.cors || [domain],
            rewriteDomain: atPath.rewriteDomain,
            relative: atPath.relative
        }
    }

    private getConfigFromDomain(atDomain: ConfigAtDomain, _path: string): [Nullable<ConfigAtPathRaw>, number] {
        const path = Config.splitPath(_path)

        const atPaths = this.getPaths(atDomain)

        for (const [key, atPath] of atPaths)
            if (this.comparePaths(path, key))
                return [atPath, atPath.relative ? Config.fixPath(key.join('/')).length : 1]

        return [null, 0]
    }

    private comparePaths(reqPath: string[], cfgPath: string[]) {
        if (reqPath.length < cfgPath.length)
            return false

        for (let i = 0; i < cfgPath.length; i++)
            if (reqPath[i] != cfgPath[i])
                return false

        return true
    }

    private getPaths(atDomain: ConfigAtDomain) {
        return Object.entries(atDomain)
            .filter(([key, val]) =>
                (key != CERT_NAME) && (typeof val != 'string'))
            .map(([key, val]) =>
                [Config.splitPath(key), val] as [string[], ConfigAtPathRaw])
            .sort(([a], [b]) =>
                b.length - a.length)
    }

    async save() {
        await Config.save(this.repr(), this.volumePath)
    }
}

export type ConfigAtPath = Required<ConfigAtPathRaw> & ConfigAtPathCommon

export type ConfigAtPathRaw = ConfigAtPathDynamic | ConfigAtPathStatic

export interface ConfigAtPathCommon {
    /**
     * Auto calculated field 
     */
    exclude: number
}

export interface ConfigAtPathStatic {
    /** 
     * Will redirect request to local file from this **folder**
     * 
     * **Note:** this folder must be in volume folder
     */
    folder: string

    /**
     * Allowed origins
     * 
     * Use **"*"** to disable cors
     * 
     * **Default:** [req.hostname]
     */
    cors?: Cors

    /**
     * Remove path from request path
     * 
     * **Example:** ({"test.com": "/api/": {"folder": "volFolder"}})
     * * *true* - Get **http://test.com/api/test** => Get **./volume/volFolder/test**
     * * *false* - Get **http://test.com/api/test** => Get **./volume/volFolder/api/test**
     * 
     * **Default:** false
     */
    relative?: boolean
}

export interface ConfigAtPathDynamic {
    /** 
     * Will redirect request to http server with this **domain** or **ip**
     */
    domain: string

    /** 
     * Will redirect request to http server with this **port**
     * 
     * **Default:**
     * * *for http* - 80
     * * *for https* - 443
     */
    port?: number


    /**
     * Will redirect request to http server with this **headers**
     * 
     * **Default:** {}
     */
    headers?: { [key: string]: string }

    /**
     * Use https protocol instead of http when redirecting
     * 
     * **Default:** false
     */
    https?: boolean

    /**
     * Allowed origins
     * 
     * Use **"*"** to disable cors
     * 
     * **Default:** [req.hostname]
     */
    cors?: Cors


    /**
     * Use domain (or ip) of http server instead of requested domain
     * 
     * **Example:**
     * * *true* - Get **req.hostname** => Get **config.domain** with header Host=**config.domain**
     * * *false* - Get **req.hostname** => Get **config.domain** with header Host=**req.hostname**
     * 
     * **Default:** false
     */
    rewriteDomain?: boolean

    /**
     * Remove path from request path
     * 
     * **Example:** ({"test.com": "/api/": {"domain": "localhost"}})
     * * *true* - Get **http://test.com/api/test** => Get **http:/localhost/test**
     * * *false* - Get **http://test.com/api/test** => Get **http:/localhost/api/test**
     * 
     * **Default:** false
     */
    relative?: boolean
}

export interface ConfigAtDomain extends Dict<ConfigAtPathRaw | DomainCertName> { }

export interface IConfig {
    domains: Dict<ConfigAtDomain>
}