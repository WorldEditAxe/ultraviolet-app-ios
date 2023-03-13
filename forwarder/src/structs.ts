import { UpgradeErrorCode } from "./enums.js"

export type UpgradeFailure = {
    error: UpgradeErrorCode.ERR_AUTH_FAIL,
    message: string
}