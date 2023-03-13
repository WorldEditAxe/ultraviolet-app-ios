import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export default class CLoginPacket implements IPacket {
    id: number = 0x01
    boundTo: "CLIENT" | "SERVER" = "SERVER"

    password?: string

    from(buff: Buffer): this {
        this.password = Protocol.readString(buff).value
        return this
    }

    to(): Buffer {
        return Protocol.writeString(this.password!)
    }
}