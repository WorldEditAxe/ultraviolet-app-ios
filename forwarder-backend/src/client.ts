import { Socket } from "net";

export class UVClient {
    socket: Socket
    connections: Connection[]

    constructor(socket: Socket) {
        this.socket = socket
        this.connections = []
    }
}

export class Connection {
    socket: Socket
    uvClient: UVClient
    
    constructor(socket: Socket, uvClient: UVClient) {
        this.socket = socket
        this.uvClient = uvClient
    }
}

export enum ConnectionState {
    CONNECTED,
    DISCONNECTED
}