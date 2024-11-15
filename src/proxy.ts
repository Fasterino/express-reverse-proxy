import express, { Request, Response } from "express"

import { Duplex } from "node:stream"
import { IncomingMessage } from 'http'
import httpProxy from 'http-proxy'
import cors from 'cors'

import { resolve, join } from 'path'
import { lstat } from 'fs'
import { Config, ConfigAtPath } from "./config"


export default function getProxy(cfg: Config) {
    const volumePath = resolve(cfg.volumePath),
        app = express(),
        proxy = httpProxy.createProxyServer(),
        corsOptionsDelegate = function (req: Request, callback: (a: any, b: { origin: boolean }) => null) {
            const proxyData = getProxyData(req),
                _origin = (req.header('Origin') || req.header('Referer') || 'None').split('//'),
                origin = _origin[_origin.length - 1].split('/')[0].split(':')[0]

            let answer = false

            if (proxyData)
                if (proxyData.cors == '*')
                    answer = true
                else
                    for (const domain of proxyData.cors)
                        if (origin.endsWith(domain)) {
                            answer = true
                            break
                        }

            if (req.res)
                req.res.locals.cors = answer

            callback(null, { origin: answer })
        }

    function prettyLog(data: any) {
        console.log(JSON.stringify(data, undefined, 2))
    }

    function handleRequest(proxyData: ConfigAtPath, req: Request, res: Response) {
        const log: { [key: string]: any } = {
            'IN_HOST': req.hostname,
            'IN_PATH': req.path,
            'IN_QUERY': req.query,
            'IN_HEADERS': req.headers,
            'CORS_ALLOWED': !!res.locals.cors
        }

        if (Config.isStatic(proxyData)) {
            log.PROXY_TYPE = 'STATIC'
            const path = join(volumePath, proxyData.folder, '/' + req.path.substring(proxyData.exclude))
            log.FILE_PATH = path
            lstat(path, (err, stat) => {
                if (err || !stat.isFile()) {
                    log.FILE_FOUND = false
                    prettyLog(log)

                    res.status(404).send('<h1>File not exist</h1>')
                    return
                }
                log.FILE_FOUND = false
                prettyLog(log)

                res.sendFile(path)
            })
            return
        }

        const domain = req.headers.host = proxyData.rewriteDomain ? proxyData.domain : req.hostname
        const headers = req.headers = { ...proxyData.headers, ...req.headers }
        const target = (proxyData.https ? 'https://' : 'http://') + proxyData.domain + (proxyData.port ? ':' + proxyData.port : '')

        req.url = '/' + req.url.substring(proxyData.exclude)

        log.PROXY_TYPE = 'DYNAMIC'
        log.REDIRECTED_TO = target
        log.OUT_HOST = domain
        log.OUT_PATH = req.path
        log.OUT_HEADERS = headers
        prettyLog(log)

        proxy.web(req, res, {
            target,
            hostRewrite: domain
        }, () => res.status(503).send('Service unavailable'))
    }

    function getProxyData(req: { hostname: string, path: string }): ConfigAtPath {
        return cfg.getProxyData(req.hostname, req.path)
    }

    app.use(cors(corsOptionsDelegate))

    app.use((req, res) => {
        const proxyData = getProxyData(req)
        if (proxyData)
            return handleRequest(proxyData, req, res)

        prettyLog({
            'IN_HOST': req.hostname,
            'IN_PATH': req.path,
            'IN_QUERY': req.query,
            'IN_HEADERS': req.headers,
            'PROXY_TYPE': 'NOT_FOUND'
        })
        res.status(404).send('Not found')
    })

    return {
        app,
        upgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => {

            const { hostname, pathname: path } = new URL(req.url, `http://${req.headers.host}`)
            const proxyData = getProxyData({
                hostname,
                path
            })

            if (proxyData && !Config.isStatic(proxyData))
                proxy.ws(req, socket, head, {
                    ws: true,
                    target: 'ws://' + proxyData.domain + (proxyData.port ? ':' + proxyData.port : ''),
                    hostRewrite: proxyData.rewriteDomain ? proxyData.domain : hostname
                }, () => null)

        }
    }
}