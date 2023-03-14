import IPacket from "../../IPacket.js";
import { Protocol } from "../../protocol.js";

export default class SIdentifyFailurePacket implements IPacket {
    id: number = 0x01
    boundTo: "CLIENT" | "SERVER" = "CLIENT"

    reason?: number

    from(buff: Buffer): this {
        this.reason = Protocol.readVarInt(buff).value
        return this
    }

    to(): Buffer {
        return Protocol.writeVarInt(this.reason!)
    }
}

export enum IdentifyFailureReason {
    BAD_VERSION = 0x00
}