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
import IPacket from "./IPacket.js";
import { StreamWrapper } from "./stream_wrapper.js";

const endPacketId = (new SConnectionEndPacket()).id
const newConnectionPacketId = (new SNewConnectionPacket()).id
const logger = new Logger("ConnectionManager")

export class SelfBackend extends EventEmitter {
    socket: WebSocket
    handler: StreamWrapper
    connections: DownstreamConnection[]
    state: ConnectionState = ConnectionState.CONNECTED

    constructor(socket: WebSocket, handler: StreamWrapper) {
        super()
        this.socket = socket
        this.handler = handler
        this.socket.pause()
        this.connections = []
        ;(async () => {
            await this._performHandshake()
            this._bindListeners()
        })()
    }

    private _bindListeners() {
        this.handler.once('end', () => {
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
        this.handler.on('packet', (id, packet) => {
            if (id == 0) {
                const id = Protocol.readVarInt(packet)
                if (id.value == endPacketId) {
                    const cEndPacket = new SConnectionEndPacket().from(id.newBuffer),
                        connection = this.connections.filter(c => c.channelId == cEndPacket.channelId!)[0]
                    this.emit('packet', cEndPacket)
                    if (connection) {
                        connection.destroy()
                        this.connections = this.connections.splice(this.connections.indexOf(connection), 1)
                        this.emit('connectionEnd', connection)
                    }
                } else if (packet[0] == newConnectionPacketId) {
                    const newConP = new SNewConnectionPacket().from(id.newBuffer),
                        socket = new Socket(),
                        downstreamCon = new DownstreamConnection(socket, newConP.channelId!, this)
                    this.emit('packet', newConP)
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
        })
    }

    private async _performHandshake() {
        const Cidentify = new CIdentifyPacket()
        Cidentify.protoVer = PROTO_VERSION
        Cidentify.branding = BRANDING
        this.handler.writePacket(Cidentify, 0)
        
        const readIdentify = await this.handler.readPacket(0)
        if (readIdentify[0] == 0x00) {
            const success = new SIdentifySuccessPacket().from(readIdentify[1])
            if (success.protoVer! == PROTO_VERSION) {
                logger.info(`Login Success - connected to server with branding ${success.branding} running protocol version ${success.protoVer}!`)
                this.emit('ready')
            } else {
                logger.error(`Incompatible protocol versions: agent is running ${success.protoVer} but the backend is running ${PROTO_VERSION}!`)
                process.exit(1)
            }
        } else {
            const failure = new SIdentifyFailurePacket().from(readIdentify[1])
            logger.error(`Login Failure! Backend was disconnected for ${Object.keys(IdentifyFailureReason)[Object.values(IdentifyFailureReason).indexOf(failure.reason!)]}.`)
            logger.error(`Is the backend and agent both running on the same protocol version? The backend is running protocol version ${PROTO_VERSION}.`)
            process.exit(1)
        }
    }
}

export declare interface SelfBackend {
    on(event: 'ready', listener: Function): this
    once(event: 'ready', listener: Function): this

    on(event: 'packet', listener: (packet: IPacket) => void | Function): this
    once(event: 'packet', listener: (packet: IPacket) => void | Function): this

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
    channelId: number
    isClosed: boolean = false
    
    constructor(socket: Socket, connectionId: number, uvClient: SelfBackend) {
        super()
        this.channelId = connectionId
        this.backend = uvClient
        this.socket = socket
        this._bindListeners()
        this.backend.connections.push(this)
        this.backend.emit('connectionOpen', this)
    }

    private _bindListeners() {
        this.backend.handler.on('packet', this._readCb)
    }

    private _readCb(id: number, data: Buffer) {
        if (id == this.channelId) {
            this.push(data)
        }
    }

    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        const data = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string, encoding)
        this.backend.handler.writeRaw(data, this.channelId)
        callback()
    }

    public _read(size: number): void {
        // data is already pushed to the read buffer via the listener
    }

    public _destroy(error: Error | null, callback: (error: Error | null) => void): void {
        const destroyPacket = new CConnectionEndPacket()
        destroyPacket.channelId = this.channelId
        this.backend.handler.writePacket(destroyPacket, 0)
        this.backend.handler.removeListener("packet", this._readCb)
        this.backend.connections = this.backend.connections.splice(this.backend.connections.indexOf(this), 1)
        this.isClosed = true
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}