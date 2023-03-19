import Logger from "./logger.js";
import config from "./config.js"
import { SelfBackend } from "./client.js";
import { WebSocket } from "ws"
import { StreamWrapper } from "./stream_wrapper.js";
process.env.PORT = config.serverPort.toString()

const logger = new Logger("Forwarder")
let forwarder: SelfBackend

logger.info("Starting Forwarder iOS Backend...")
logger.info("<--- CONFIG --->")
logger.info(`-> Server IP: ${config.serverIp}`)
logger.info(`-> Server Port: ${config.serverPort}`)
logger.info(`-> Agent IP: ${config.agentIp}`)
logger.info(`-> Agent Port: ${config.agentPort}`)
logger.info(`-> Is Connection Secure: ${config.agentSecure ? "Yes" : "No"}`)
logger.info(`-> Password: ${config.password ? "<redacted>" : "<none set>"}`)
logger.info("<--- CONFIG --->")
if (!config.password) {
    logger.warn("You don't have a password set! This is a security risk, please configure your server to utilize a password.")
}

logger.info(`Connecting to agent at ws${config.agentSecure ? 's' : ''}://${config.agentIp}:${config.agentPort}...`)
const ws = new WebSocket(`ws${config.agentSecure ? 's' : ''}://${config.agentIp}:${config.agentPort}/gateway/${Math.floor(Date.now() / 100000)}`, {
    headers: {
        'sec-auth-key': config.password ?? "NONE"
    }
}),
    closeListener = () => {
        logger.error(`Failed to connect to agent. Are you sure the agent program is running? Try again later.`)
        process.exit(1)
    }
ws.once('error', closeListener)
ws.on('open', () => {
    logger.info(`Connected to WebSocket backend, attempting to complete handshake...`)
    const handler = new StreamWrapper(ws)
    forwarder = new SelfBackend(ws, handler)
    forwarder.once('ready', () => {
        logger.info(`Logged in! The backend forwarder is ready. Access the server by heading to the agent server's server address.`)
    })
})