import http from "http"
import { WebSocket } from "ws";

export class UVClient {
    socket: WebSocket
    connections: Connection[]

    constructor(socket: WebSocket) {
        this.socket = socket
        this.connections = []
    }
}

export class Connection {
    req: http.ClientRequest
    res: http.ServerResponse
    uvClient: UVClient
    
    constructor(req: http.ClientRequest, res: http.ServerResponse, uvClient: UVClient) {
        this.req = req
        this.res = res
        this.uvClient = uvClient
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}