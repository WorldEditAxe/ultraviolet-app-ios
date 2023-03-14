import EventEmitter from "events";
import http from "http"
import { Duplex } from "stream";
import { WebSocket } from "ws";
import { CConnectionEndPacket } from "./packets/ready/CConnectionEndPacket.js";
import { SConnectionEndPacket } from "./packets/ready/SConnectionEndPacket.js";
import { Protocol } from "./protocol.js";

const endPacketId = (new SConnectionEndPacket()).id

export class UVClient extends EventEmitter {
    socket: WebSocket
    connections: UpstreamConnection[]
    state: ConnectionState = ConnectionState.CONNECTED
    freedConnectionIds: number[] = []
    nextConnectionId: number = 1

    constructor(socket: WebSocket) {
        super()
        this.socket = socket
        this.connections = []
        this._bindListeners()
    }

    private _bindListeners() {
        ;(async () => {
            while (true) {
                if (this.socket.readyState == this.socket.OPEN) {
                    const packet = await Protocol.readPacket(this.socket, 0)
                    if (packet[1] == endPacketId) {
                        const cEndPacket = new CConnectionEndPacket().from(packet[2]),
                            connection = this.connections.filter(c => c.connectionId == cEndPacket.channelId!)[0]
                        if (connection) {
                            connection.destroy()
                            this.connections = this.connections.splice(this.connections.indexOf(connection), 1)
                            this.returnConnectionId(connection.connectionId)
                            this.emit('connectionEnd', connection)
                        }
                    }
                } else {
                    this.state = ConnectionState.DISCONNECTED
                    this.connections.forEach(c => {
                        if (!c.destroyed) {
                            c.destroy()
                            this.emit('connectionEnd', c)
                        }
                    })
                    this.connections = []
                    this.freedConnectionIds = []
                    this.nextConnectionId = 1
                    this.emit('end')
                    break
                }
            }
        })()
    }

    getNextConnectionId(): number {
        if (this.freedConnectionIds.length > 0) {
            const end = this.freedConnectionIds[0]
            this.freedConnectionIds = this.freedConnectionIds.slice(1)
            return end
        } else {
            const ret = this.nextConnectionId
            this.nextConnectionId++
            return ret
        }
    }

    returnConnectionId(cId: number) {
        this.freedConnectionIds.push(cId)
    }
}

export declare interface UVClient {
    on(event: 'ready', listener: Function): this
    once(event: 'ready', listener: Function): this

    on(event: 'end', listener: Function): this
    once(event: 'end', listener: Function): this

    on(event: 'connectionEnd', listener: (connection: UpstreamConnection) => void | Function): this
    once(event: 'connectionEnd', listener: (connection: UpstreamConnection) => void | Function): this

    on(event: 'connectionOpen', listener: (connection: UpstreamConnection) => void | Function): this
    once(event: 'connectionOpen', listener: (connection: UpstreamConnection) => void | Function): this
}

export class UpstreamConnection extends Duplex {
    uvClient: UVClient
    connectionId: number
    isClosed: boolean = false
    
    constructor(connectionId: number, uvClient: UVClient) {
        super()
        this.connectionId = connectionId
        this.uvClient = uvClient
        this._bindListeners()
        this.uvClient.connections.push(this)
        this.uvClient.emit('connectionOpen', this)
    }

    private _bindListeners() {
        ;(async () => {
            while (true) {
                if (this.closed) {
                    break
                } else {
                    const data = await Protocol.readChannelRaw(this.uvClient.socket, this.connectionId)
                    this.push(data)
                }
            }
        })()
    }

    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        const data = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string, encoding)
        Protocol.writeRaw(this.uvClient.socket, this.connectionId, data)
        callback()
    }

    public _read(size: number): void {
        // data is already pushed to the read buffer via the listener
    }

    public _destroy(error: Error | null, callback: (error: Error | null) => void): void {
        const destroyPacket = new SConnectionEndPacket()
        destroyPacket.channelId = this.connectionId
        Protocol.writePacket(this.uvClient.socket, this.connectionId, destroyPacket)
        this.uvClient.connections = this.uvClient.connections.splice(this.uvClient.connections.indexOf(this), 1)
        this.uvClient.returnConnectionId(this.connectionId)
        this.isClosed = true
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}