# NodeJS Reverse Proxy (based on Express)
* Compatible with **Docker**
* Compatible with **HTTPS** protocol
* Suitable for:
  * Separation of http services by **URL domain**
  * Separation of http services by **URL path**
  * Making a **pseudo-mirror** (not direct forwarding)
  * Adding **static content** (e.g sharing some files)
* **Easy setup** (All settings are stored in a JSON file)
* Well-configured logging

## Quick Setup (Docker)
* Clone the repository
* Configure the *docker-compose.yml* (Hints are included as comments)
* Create a folder of your volume if you haven't done so
* Run docker compose up
```bash
docker compose up -d
# or
docker-compose up -d
```
* Check the volume folder
  * Here you can find the *config.json* file, it contains examples of how it can be used
  * Configure this file as you need
* Restart the container
* Check the logs if something went wrong

## Config.json Guide
Config has next structure
```ts
// Pseudo TypeScript code

const config: {
  domains: {
    [domain: string]: Domain
  }
} = parseJsonFromConfigFile(...)

type Domain = {
  /**
   * Name of folder with domain certificates
   * Will use this two files:
   * * %CERTS_PATH%/%cert-name%/privkey.pem
   * * %CERTS_PATH%/%cert-name%/fullchain.pem
   */
  'cert-name': string 
} & {
  [path: string]: StaticProxyInfo | DynamicProxyInfo
}

type StaticProxyInfo = {
    /** 
     * Will redirect request to local file from this **folder**
     * 
     * **Note:** this folder must be in volume folder
     */
    folder: string

    /**
     * Allowed origins
     * 
     * Use "*" to disable cors
     * 
     * **Default:** [req.hostname]
     */
    cors?: string[] | "*"

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

type DynamicProxyInfo = {
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
     * Use "*" to disable cors
     * 
     * **Default:** [req.hostname]
     */
    cors?: string[] | "*"


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
```
