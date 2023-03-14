import { UpgradeErrorCode } from "./enums.js"

export type UpgradeFailure = {
    error: UpgradeErrorCode,
    message: string
}