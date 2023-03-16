import EventEmitter from "events";
import config from "./config.js"
import { Socket } from "net";
import { Duplex } from "stream";
import { WebSocket } from "ws";
import Logger from "./logger.js";
import { BRANDING, PROTO_VERSION } from "./meta.js";
import CIdentifyPacket from "./packets/identify/CIdentifyPacket.js";
import SIdentifyFailurePacket, { IdentifyFailureReason } from "./packets/identify/SIdentifyFailurePacket.js";
import SIdentifySuccessPacket from "./packets/identify/SIdentifySuccessPacket.js";
import { CConnectionEndPacket } from "./packets/ready/CConnectionEndPacket.js";
import { SConnectionEndPacket } from "./packets/ready/SConnectionEndPacket.js";
import SNewConnectionPacket from "./packets/ready/SNewConnectionPacket.js";
import { Protocol } from "./protocol.js";

const endPacketId = (new SConnectionEndPacket()).id
const newConnectionPacketId = (new SNewConnectionPacket()).id
const logger = new Logger("ConnectionManager")

export class SelfBackend extends EventEmitter {
    socket: WebSocket
    connections: DownstreamConnection[]
    state: ConnectionState = ConnectionState.CONNECTED

    constructor(socket: WebSocket) {
        super()
        this.socket = socket
        this.connections = []
        ;(async () => {
            await this._performHandshake()
            this._bindListeners()
        })()
    }

    private _bindListeners() {
        this.socket.once('close', () => {
            logger.info(`Remote WebSocket connection closed, exiting!`)
            this.connections.forEach(c => {
                if (!c.destroyed) {
                    c.destroy()
                    this.emit('connectionEnd', c)
                }
            })
            this.connections = []
            this.emit('end')
            process.exit(1)
        })
        ;(async () => {
            while (true) {
                if (this.socket.readyState == this.socket.OPEN) {
                    const packet = await Protocol.readPacket(this.socket, 0)
                    if (packet[1] == endPacketId) {
                        const cEndPacket = new SConnectionEndPacket().from(packet[2]),
                            connection = this.connections.filter(c => c.connectionId == cEndPacket.channelId!)[0]
                        if (connection) {
                            connection.destroy()
                            this.connections = this.connections.splice(this.connections.indexOf(connection), 1)
                            this.emit('connectionEnd', connection)
                        }
                    } else if (packet[1] == newConnectionPacketId) {
                        const newConP = new SNewConnectionPacket().from(packet[2]),
                            socket = new Socket(),
                            downstreamCon = new DownstreamConnection(socket, newConP.channelId!, this)
                        console.log(newConP.channelId)
                        socket.connect({
                            host: config.serverIp,
                            port: config.serverPort
                        }, () => {
                            logger.info(`[CONNECTION] New downstream connection from [/${newConP.ip}:${newConP.port}].`)
                        }).once('error', () => {
                            downstreamCon.destroy()
                        })
                        socket.on('data', d => downstreamCon.write(d))
                        downstreamCon.on('data', d => {
                            console.log(d.toString())
                            socket.write(d)
                        })

                        socket.once('close', () => downstreamCon.destroy())
                        downstreamCon.once('close', () => downstreamCon.destroy())
                    }
                }
            }
        })()
    }

    private async _performHandshake() {
        const Cidentify = new CIdentifyPacket()
        Cidentify.protoVer = PROTO_VERSION
        Cidentify.branding = BRANDING
        Protocol.writePacket(this.socket, 0, Cidentify)
        
        const readIdentify = await Protocol.readPacket(this.socket, 0)
        if (readIdentify[1] == 0x00) {
            const success = new SIdentifySuccessPacket().from(readIdentify[2])
            if (success.protoVer! == PROTO_VERSION) {
                logger.info(`Login Success - connected to server with branding ${success.branding} running protocol version ${success.protoVer}!`)
                this.emit('ready')
            } else {
                logger.error(`Incompatible protocol versions: agent is running ${success.protoVer} but the backend is running ${PROTO_VERSION}!`)
                process.exit(1)
            }
        } else {
            const failure = new SIdentifyFailurePacket().from(readIdentify[2])
            logger.error(`Login Failure! Backend was disconnected for ${Object.keys(IdentifyFailureReason)[Object.values(IdentifyFailureReason).indexOf(failure.reason!)]}.`)
            logger.error(`Is the backend and agent both running on the same protocol version? The backend is running protocol version ${PROTO_VERSION}.`)
            process.exit(1)
        }
    }
}

export declare interface SelfBackend {
    on(event: 'ready', listener: Function): this
    once(event: 'ready', listener: Function): this

    on(event: 'end', listener: Function): this
    once(event: 'end', listener: Function): this

    on(event: 'connectionEnd', listener: (connection: DownstreamConnection) => void | Function): this
    once(event: 'connectionEnd', listener: (connection: DownstreamConnection) => void | Function): this

    on(event: 'connectionOpen', listener: (connection: DownstreamConnection) => void | Function): this
    once(event: 'connectionOpen', listener: (connection: DownstreamConnection) => void | Function): this
}

export class DownstreamConnection extends Duplex {
    backend: SelfBackend
    socket: Socket
    connectionId: number
    isClosed: boolean = false
    
    constructor(socket: Socket, connectionId: number, uvClient: SelfBackend) {
        super()
        this.connectionId = connectionId
        this.backend = uvClient
        this.socket = socket
        this._bindListeners()
        this.backend.connections.push(this)
        this.backend.emit('connectionOpen', this)
    }

    private _bindListeners() {
        ;(async () => {
            while (true) {
                if (this.closed) {
                    break
                } else {
                    const data = await Protocol.readChannelRaw(this.backend.socket, this.connectionId)
                    this.push(data)
                }
            }
        })()
    }

    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        const data = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string, encoding)
        Protocol.writeRaw(this.backend.socket, this.connectionId, data)
        callback()
    }

    public _read(size: number): void {
        // data is already pushed to the read buffer via the listener
    }

    public _destroy(error: Error | null, callback: (error: Error | null) => void): void {
        const destroyPacket = new CConnectionEndPacket()
        destroyPacket.channelId = this.connectionId
        Protocol.writePacket(this.backend.socket, this.connectionId, destroyPacket)
        this.backend.connections = this.backend.connections.splice(this.backend.connections.indexOf(this), 1)
        this.isClosed = true
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}