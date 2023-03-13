import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export class CConnectionEndPacket implements IPacket {
    id: number = 0x00
    boundTo: "CLIENT" | "SERVER" = "CLIENT"

    channelId?: number

    from(buff: Buffer): this {
        this.channelId = Protocol.readVarInt(buff).value
        return this
    }

    to(): Buffer {
        return Protocol.writeVarInt(this.channelId!)
    }
}