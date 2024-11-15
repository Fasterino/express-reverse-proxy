import { RequestListener } from "http"
import https from "https"
import tls from "tls"
import fs from "fs"
import { Config } from "./config"
import { join } from "path"


export function getHttps(cfg: Config, letsencryptPath: string) {
    const secureContexts = getSecureContexts(cfg, letsencryptPath)

    const options: https.ServerOptions = {
        // A function that will be called if the client supports SNI TLS extension.
        SNICallback: (domain, cb) => {

            const ctx = secureContexts[domain]

            if (cb) {
                ctx ? cb(null, ctx) : cb(Error("No ctx"))
            } else if (ctx) {
                return ctx
            }
        },
    }

    return (app: RequestListener) => https.createServer(options, app)
}

function getSecureContexts(config: Config, letsencryptPath: string) {
    return Object.fromEntries(
        Object.entries(config.getCerts())
            .filter(([_, value]) => value)
            .map(([key, value]) =>
                [key, tls.createSecureContext({
                    key: fs.readFileSync(join(letsencryptPath, value, "/privkey.pem")),
                    cert: fs.readFileSync(join(letsencryptPath, value, "/fullchain.pem")),
                    ca: null,
                })])
    )
}
