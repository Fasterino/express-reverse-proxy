import { getHttps } from "./https"
import { createServer as httpServer } from 'http'
import { Config } from "./config"
import getProxy from "./proxy"
import { env } from "./env"


const HTTP_PORT = env.HTTP_PORT(52080),
    HTTPS_PORT = env.HTTPS_PORT(-1),
    VOLUME_PATH = env.VOLUME_PATH('./vol'),
    CERTS_PATH = env.LOAD_CERTS_FROM_VOLUME(0) ? VOLUME_PATH : env.CERTS_PATH('/etc/letsencrypt/live/')

console.log("ENV Loaded:", {
    HTTP_PORT,
    HTTPS_PORT: HTTPS_PORT + (HTTPS_PORT == -1 ? ' (WITHOUT HTTPS)' : ''),
    VOLUME_PATH,
    CERTS_PATH: CERTS_PATH + (env.LOAD_CERTS_FROM_VOLUME(0) ? ' (Loaded from VOLUME_PATH)' : ''),
})

async function main() {
    const config = await Config.load(VOLUME_PATH),
        { app, upgrade } = getProxy(config)

    httpServer(app).on('upgrade', upgrade).listen(HTTP_PORT, function () {
        console.log("Listening http on port: " + HTTP_PORT)
    })
    if (HTTPS_PORT != -1) {
        const httpsServer = getHttps(config, CERTS_PATH)
        httpsServer(app).on('upgrade', upgrade).listen(HTTPS_PORT, function () {
            console.log("Listening https on port: " + HTTPS_PORT)
        })
    }
}

main()