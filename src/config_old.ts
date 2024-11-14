import fs from 'fs';

export interface Config {
    default?: ConfigProxyPaths
    hosts: {
        [domain: string]: ConfigProxyPaths
    },
    certs: ConfigCerts
}
export interface ConfigCerts {
    [folder: string]: {
        domain: string
        allowSubdomains: boolean
    }
}
export interface ConfigProxyPaths {
    [path: string]: ConfigProxy | ConfigProxyStatic
}

type Cors = string[] | '*'

export interface ConfigProxy {
    domain: string
    port?: number
    headers?: { [key: string]: string }
    https?: boolean
    cors?: Cors
    useNativeDomain?: boolean
    relative?: boolean
}

export interface ConfigProxyStatic {
    static: string
    cors?: Cors
}

export default function getConfig(path: string): Config {
    return JSON.parse(
        fs.readFileSync(path, 'utf8')
    )
}