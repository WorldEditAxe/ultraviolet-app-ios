import http from "http"
import { WebSocket } from "ws";

export class UVClient {
    socket: WebSocket
    connections: (Connection | WSConnection)[]
    freedConnectionIds: number[] = []
    nextConnectionId: number = 0

    constructor(socket: WebSocket) {
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

export class Connection {
    req: http.ClientRequest
    res: http.ServerResponse
    uvClient: UVClient
    connectionId: number
    readonly type = ConnectionType.HTTP
    
    constructor(req: http.ClientRequest, res: http.ServerResponse, connectionId: number, uvClient: UVClient) {
        this.req = req
        this.res = res
        this.connectionId = connectionId
        this.uvClient = uvClient
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