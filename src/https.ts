import { RequestListener } from "http"
import https from "https"
import tls from "tls"
import fs from "fs"
import { Config } from "./config"
import { join } from "path"
import { execSync } from "child_process"

export function getHttps(cfg: Config, certsPath: string, autoCerts: boolean) {
    const secureContexts = getSecureContexts(cfg, certsPath)

    function resolveCert(cb: (...args: any[]) => void, domain: string) {
        const ctx = secureContexts[domain]
        if (cb) {
            ctx ? cb(null, ctx) : cb(Error(`No ctx for domain ${domain}`))
            return
        } else if (ctx) {
            return ctx
        }

        throw Error(`No ctx for domain ${domain}`)
    }

    const options: https.ServerOptions = {
        // A function that will be called if the client supports SNI TLS extension.
        SNICallback: (domain, cb) => {
            if (!(domain in secureContexts) && autoCerts) {
                const certName = `${domain}-auto-generated`
                const certDir = getCertPath(certsPath, certName)
                console.log(`${certName} certificate verification`)

                try {
                    if (fs.existsSync(certDir)) {
                        if (isValidCert(certsPath, certName)) {
                            console.log("Found!")
                            secureContexts[domain] = loadCert(certName, certsPath)
                            return resolveCert(cb, domain)
                        }

                        fs.rmSync(certDir, { recursive: true, force: true })
                    }
                    else
                        console.log("Not found!")

                    console.log("Generating a new certificate...")

                    secureContexts[domain] = generateCert(domain, certName, certsPath)

                    console.log("Generated!")
                } catch (error) {
                    console.error("Certificate handling failed:", error)
                }
            }
            return resolveCert(cb, domain)
        },
    }

    return (app: RequestListener) => https.createServer(options, app)
}

function getCertPath(certsPath: string, certName: string, key: string | null = null) {
    return key ? join(certsPath, certName, `${key}.pem`) : join(certsPath, certName)
}

function isValidCert(certsPath: string, certName: string) {
    try {
        const fullchainPath = getCertPath(certsPath, certName, "fullchain");
        const privkeyPath = getCertPath(certsPath, certName, "privkey");

        // Check if both certificate and key exist
        if (!fs.existsSync(fullchainPath)
            || !fs.existsSync(privkeyPath))
            throw new Error("Certificate was deleted")

        // Verify certificate validity using OpenSSL's built-in check
        const checkSeconds = 30 * 86400; // 30 days in seconds
        execSync(
            `openssl x509 -checkend ${checkSeconds} -noout -in "${fullchainPath}"`,
            { stdio: 'ignore' }
        );

        // Additional verification of the key pair
        execSync(
            `openssl rsa -check -noout -in "${privkeyPath}"`,
            { stdio: 'ignore' }
        );

        return true;
    } catch (error) {
        console.debug("Certificate validation failed:", error);
        return false;
    }
}

function generateCert(domain: string, certName: string, certsPath: string) {
    const certDir = getCertPath(certsPath, certName)
    fs.mkdirSync(certDir, { recursive: true })

    const privkeyPath = getCertPath(certsPath, certName, "privkey")
    const fullchainPath = getCertPath(certsPath, certName, "fullchain")

    // Generate private key
    execSync(`openssl genrsa -out ${privkeyPath} 2048`)

    // Generate self-signed certificate
    execSync(`openssl req -new -x509 -key ${privkeyPath} -out ${fullchainPath} -days 395 -subj "/CN=${domain}"`)

    return loadCert(certName, certsPath)
}

function loadCert(certName: string, certsPath: string) {
    return tls.createSecureContext({
        key: fs.readFileSync(getCertPath(certsPath, certName, "privkey")),
        cert: fs.readFileSync(getCertPath(certsPath, certName, "fullchain")),
        ca: null,
    })
}

/** Obtaining certs specified by the user in the 'cert-name' field */
function getSecureContexts(config: Config, certsPath: string) {
    return Object.fromEntries(
        Object.entries(config.getCerts())
            .map(([key, value]) =>
                [key, loadCert(value, certsPath)])
    )
}
