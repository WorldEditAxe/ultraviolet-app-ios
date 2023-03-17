import config from "./config.js"
import http from "http"
import URL from "url";
import { UpgradeErrorCode } from "./enums.js";
import { UpgradeFailure } from "./structs.js";
import { Socket } from "net";
import { WebSocket } from "ws";
import Logger from "./logger.js";
import CIdentifyPacket from "./packets/identify/CIdentifyPacket.js";
import { Protocol } from "./protocol.js";
import { BRANDING, PROTO_VERSION } from "./meta.js";
import SIdentifyFailurePacket, { IdentifyFailureReason } from "./packets/identify/SIdentifyFailurePacket.js";
import { UpstreamConnection, RemoteBackend } from "./client.js";
import SNewConnectionPacket from "./packets/ready/SNewConnectionPacket.js";
import SIdentifySuccessPacket from "./packets/identify/SIdentifySuccessPacket.js";
import { StreamWrapper } from "./stream_wrapper.js";
import { CCAckConnectionOpenPacket } from "./packets/ready/CAckConnectionOpenPacket.js";
import { pack } from "msgpackr";

const logger = new Logger("ConnectionHandler")

export namespace HTTPUtil {
    export async function route(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL.URL(req.url!, `http://${req.headers.host!}`)
        if (HTTPUtil.isGatewayConnectionAttempt(url.pathname!)) {
            res.writeHead(400)
                .end(JSON.stringify({
                    error: UpgradeErrorCode.ERR_NOT_WS_CON,
                    message: "Non-WebSocket upgrade request made to gateway connect route."
                } as UpgradeFailure))
        } else {
            if (!BACKEND) {
                res.writeHead(502)
                    .end("Hello! This server is not connected to an Ultraviolet iOS backend. Pair your backend instance for this website to work.")
            } else {
                HTTPUtil.forwardHTTP(req, res)
            }
        }
    }

    export function isGatewayConnectionAttempt(route: string): boolean {
        return route == `/gateway/${Math.floor(Date.now() / 100000)}`
    }

    export async function handleUpgrade(req: http.IncomingMessage, socket: Socket, head: Buffer) {
        try {
            const url = URL.parse(req.url!)
            if (HTTPUtil.isGatewayConnectionAttempt(url.pathname!)) {
                if (req.headers["sec-auth-key"] === config.password || !config.password) {
                    if (BACKEND) {
                        socket.end()
                    } else {
                        if (WS.shouldHandle(req)) {
                            let resolved = false
                            setTimeout(() => {
                                if (!resolved) {
                                    logger.warn(`Connection from [/${socket.remoteAddress}:${socket.remotePort}] timed out whilst authenticating!`)
                                    socket.end()
                                }
                            }, 30000)
                            const ws = await new Promise<WebSocket>(res => {
                                WS.handleUpgrade(req, socket, head, ws => {
                                    res(ws)
                                })
                            }), handler = new StreamWrapper(ws)
                            const Cidentify = new CIdentifyPacket().from((await handler.readPacket(0, 0))[1])
                            if (Cidentify.protoVer! === PROTO_VERSION) {
                                const Sidentify = new SIdentifySuccessPacket()
                                Sidentify.branding = BRANDING
                                Sidentify.protoVer = PROTO_VERSION
                                Sidentify.url = `https://${CONFIG.bindIp}:${CONFIG.bindPort}/`
                                handler.writePacket(Sidentify, 0)
                                const uvClient = new RemoteBackend(ws, handler)
                                global.BACKEND = uvClient
                                logger.info(`Login Success! Client [/${socket.remoteAddress}:${socket.remotePort}] has successfully logged in as the upstream server.`)
                                uvClient.emit('ready')
                                resolved = true
                            } else {
                                const SError = new SIdentifyFailurePacket()
                                SError.reason = IdentifyFailureReason.BAD_VERSION
                                handler.writePacket(SError, 0)
                                ws.close()
                                resolved = true
                            }
                        } else {
                            socket.end()
                        }
                    }
                } else {
                    socket.end()
                }
            } else {
                if (BACKEND) {
                    HTTPUtil.forwardWS(req, socket, head)
                } else {
                    socket.end()
                }
            }
        } catch (err) {
            logger.warn(`An error was thrown whilst handing HTTP request!\n${(err as any).stack ?? err}`)
        }
    }

    /* NOTE: these are to be converted back into a TCP connection */

    export async function forwardHTTP(req: http.IncomingMessage, res: http.ServerResponse) {
        const headers = req.headers,
            route = new URL.URL(req.url!, `http://${req.headers.host!}`)
        const httpConnection = http.request(route, {
            createConnection: (options, callback) => {
                const cId = BACKEND!.getNextConnectionId(),
                    packet = new SNewConnectionPacket(),
                    tunnel = new UpstreamConnection(cId, BACKEND!)
                packet.channelId = cId
                packet.ip = req.socket.remoteAddress
                packet.port = req.socket.remotePort
                BACKEND!.handler.writePacket(packet, 0)
                callback(null as any, tunnel as any)
                return tunnel as any
            },
            method: req.method,
            headers: headers
        })
        httpConnection.on('response', remote => {
            res.writeHead(remote.statusCode!, remote.statusMessage, remote.headers)
            remote.pipe(res)
            remote.once('close', () => res.end())
        })
        req.pipe(httpConnection)
    }

    export function forwardWS(req: http.IncomingMessage, socket: Socket, head: Buffer) {
        if (WS.shouldHandle(req)) {
            WS.handleUpgrade(req, socket, head, async (ws, req) => {
                const headers = req.headers,
                    route = new URL.URL(req.url!, `http://${req.headers.host!}`),
                    cId = BACKEND!.getNextConnectionId(),
                    packet = new SNewConnectionPacket(),
                    virtualDuplex = new UpstreamConnection(cId, BACKEND!)
                route.protocol = 'ws'
                packet.channelId = cId
                packet.ip = req.socket.remoteAddress
                packet.port = req.socket.remotePort
                BACKEND!.handler.writePacket(packet, 0)
                const wsConnection = new WebSocket(route, {
                    // any duplex is ok
                    createConnection: () => virtualDuplex as any,
                    host: 'localhost',
                    method: req.method,
                    headers: headers
                })

                wsConnection.on('ping', data => {
                    ws.ping(data)
                })
                wsConnection.on('pong', data => {
                    ws.pong(data)
                })
                ws.on('ping', data => {
                    wsConnection.ping(data)
                })
                ws.on('pong', data => {
                    wsConnection.pong(data)
                })
                wsConnection.on('message', data => {
                    ws.send(data)
                })
                ws.on('message', data => {
                    wsConnection.send(data)
                })

                wsConnection.once('close', (code) => {
                    ws.close(code)
                })
                ws.once('close', code => {
                    wsConnection.close(code)
                })
                wsConnection.once('error', () => {
                    ws.close()
                })
                ws.once('error', () => {
                    wsConnection.close()
                })
            })
        } else {
            socket.end()
        }
    }
}