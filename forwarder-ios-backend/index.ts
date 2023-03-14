import Logger from "./logger.js";
import config from "./config.js"
import http from "http"
import https from "https"
import { HTTPUtil } from "./util.js";
import { WebSocketServer } from "ws";

const logger = new Logger("Forwarder")
let server: http.Server,
    wsServer: WebSocketServer

logger.info("Starting Forwarder Backend...")
logger.info("<--- CONFIG --->")
logger.info(`-> Server IP: ${config.serverIp}`)
logger.info(`-> Server Port: ${config.serverPort}`)
logger.info(`-> Password: ${config.password ? (config.password as string).replaceAll(/(.*?)/gmi, "*") : "<none set>"}`)
logger.info("<--- CONFIG --->")
if (!config.password) {
    logger.warn("You don't have a password set! This is a security risk, please configure your server to not .")
}
