import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export default class SLoginSuccessPacket implements IPacket {
    id: number = 0x02
    boundTo: "CLIENT" | "SERVER" = "CLIENT"

    allocatedPort?: number

    from(buff: Buffer): this {
        this.allocatedPort = Protocol.readVarInt(buff).value
        return this
    }

    to(): Buffer {
        return Protocol.writeVarInt(this.allocatedPort!)
    }
}