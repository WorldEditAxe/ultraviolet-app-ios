import Logger from "./logger.js";
import config from "./config.js"

const logger = new Logger("Forwarder")

logger.info("Starting Forwarder...")
logger.info("<--- CONFIG --->")
logger.info(`-> Bind IP: ${config.bindIp}`)
logger.info(`-> Bind Port: ${config.bindPort}`)
logger.info(`-> Password: ${config.password ? (config.password as string).replaceAll(/(.*?)/gmi, "*") : "<none set>"}`)
logger.info("<--- CONFIG --->")
if (!config.password) {
    logger.warn("You don't have a password set! This is a security risk, change this immediately.")
}

