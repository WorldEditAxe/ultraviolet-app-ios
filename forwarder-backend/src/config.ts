import dotenv from "dotenv"
dotenv.config()

export default {
    // set to 0.0.0.0 to expose to internet
    bindIp: "127.0.0.1",
    // it is suggested that you bind to port 443 to mask the forwarder's traffic as HTTPS
    bindPort: 443, 
    // can be set as null if forwarder is to be made public
    password: null
}