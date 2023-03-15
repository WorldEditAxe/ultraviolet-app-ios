import Logger from "./logger.js";
import config from "./config.js"
import http from "http"
import https from "https"
import { HTTPUtil } from "./util.js";
import { WebSocketServer } from "ws";

const logger = new Logger("Forwarder")
let server: http.Server,
    wsServer: WebSocketServer

logger.info("Starting Forwarder...")
logger.info("<--- CONFIG --->")
logger.info(`-> Bind IP: ${config.bindIp}`)
logger.info(`-> Bind Port: ${config.bindPort}`)
logger.info(`-> Password: ${config.password ? (config.password as string).replaceAll(/(.*?)/gmi, "*") : "<none set>"}`)
logger.info(`-> TLS/HTTPS: ${config.tls.key || config.tls.cert ? "Enabled" : "Disabled"}`)
logger.info("<--- CONFIG --->")
if (!config.password) {
    logger.warn("You don't have a password set! This is a security risk, change this immediately.")
}
if (!config.tls.key || !config.tls.cert) {
    logger.warn("HTTPS/TLS is not enabled! You will not be able to use Ultraviolet, as it requires the use of web workers that are unavailable under HTTP! Ignore this message if your server is ran behind a reverse proxy with SSL enabled (i.e. Nginx).")
    server = http.createServer(async (req, res) => {
        try { await HTTPUtil.route(req, res) }
        catch (err) {
            logger.warn(`Failed to handle HTTP request from [/${req.socket.remoteAddress}:${req.socket.remotePort}]!\n${(err as any).stack || err}`)
        }
    }).listen(config.bindPort, config.bindIp)
} else {
    server = https.createServer({
        key: config.tls.key,
        cert: config.tls.cert
    }, async (req, res) => {
        try { await HTTPUtil.route(req, res) }
        catch (err) {
            logger.warn(`Failed to handle HTTP request from [/${req.socket.remoteAddress}:${req.socket.remotePort}]!\n${(err as any).stack || err}`)
        }
    }).listen(config.bindPort, config.bindIp)
}
const errBindListener = (err: Error) => {
    logger.error(`Failed to bind HTTP(S) server!\n${err.stack}`)
    process.exit(1)
}

server.once('error', errBindListener)
server.on('listening', () => {
    wsServer = new WebSocketServer({ noServer: true })
    global.SERVER = server
    global.WS = wsServer
    global.CONFIG = config
    global.BACKEND = null

    server.removeListener('error', errBindListener)
    WS.on('error', err => {
        logger.warn(`WebSocket server threw an error: ${err.stack || err}`)
    })
    SERVER.on('error', err => {
        logger.warn(`HTTP server threw an error: ${err.stack || err}`)
    })
    SERVER.on('upgrade', HTTPUtil.handleUpgrade)

    logger.info(`Server successfully binded to ${config.bindIp}:${config.bindPort}!`)
})