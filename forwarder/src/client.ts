import EventEmitter from "events";
import http from "http"
import { Duplex } from "stream";
import { WebSocket } from "ws";
import { SConnectionEndPacket } from "./packets/ready/CConnectionEndPacket.js";
import { Protocol } from "./protocol.js";

export class UVClient extends EventEmitter {
    socket: WebSocket
    connections: (Connection | WSConnection)[]
    freedConnectionIds: number[] = []
    nextConnectionId: number = 0

    constructor(socket: WebSocket) {
        super()
        this.socket = socket
        this.connections = []
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

export class Connection extends Duplex {
    uvClient: UVClient
    connectionId: number
    isClosed: boolean = false
    
    constructor(connectionId: number, uvClient: UVClient) {
        super()
        this.connectionId = connectionId
        this.uvClient = uvClient
        this._bindListeners()
    }

    private _bindListeners() {
        const bindClose = (cId: number) => {
            if (cId == this.connectionId) {
                this.destroy()
                this.uvClient.removeListener('connectionEnd', bindClose)
            }
        }
        this.uvClient.on('connectionEnd', bindClose)
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
    }
}

export class WSConnection {
    ws: WebSocket
    uvClient: UVClient
    connectionId: number
    readonly type = ConnectionType.HTTP
    
    constructor(ws: WebSocket, connectionId: number, uvClient: UVClient) {
        this.ws = ws
        this.connectionId = connectionId
        this.uvClient = uvClient
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}

export enum ConnectionType {
    HTTP,
    WEBSOCKET
}