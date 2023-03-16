// dotenv is not avilable on ios due to sandbox restrictions
export default {
    // ip + port for local HTTP server
    serverIp: "127.0.0.1",
    serverPort: 8080, 

    // ip + port for the agent
    agentSecure: false,
    agentIp: "127.0.0.1",
    agentPort: 4443,
    
    // password must be same as set on server
    password: null
}