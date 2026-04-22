const WebSocket = require("ws");
const axios = require("axios");

const wss = new WebSocket.Server({ port: 8080 });

let clients = [];

// ===== CONFIG =====
const replicas = [5001, 5002, 5003];
let currentLeader = null;

// fast-fail HTTP client
const http = axios.create({
    timeout: 200
});

// ===== CONNECTION =====
wss.on("connection", (ws) => {
    console.log("Client connected");
    clients.push(ws);

    ws.on("message", async (message) => {
        try {
            const stroke = JSON.parse(message);

            const committed = await sendToLeader(stroke);

            if (committed) {
                broadcast(stroke);
            } else {
                console.log("Not committed → not broadcasting");
            }

        } catch (err) {
            console.log("Error:", err.message);
        }
    });

    ws.on("close", () => {
        clients = clients.filter(c => c !== ws);
    });
});

// ===== BROADCAST =====
function broadcast(stroke) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(stroke));
        }
    });
}

// ===== SEND TO LEADER =====
async function sendToLeader(stroke) {

    // 1️⃣ try known leader
    if (currentLeader !== null) {
        try {
            const res = await http.post(`http://localhost:${currentLeader}/stroke`, stroke);

            if (res.data.status === "committed") {
                return true;
            }
        } catch {
            console.log(`Leader ${currentLeader} failed`);
            currentLeader = null;
        }
    }

    // 2️⃣ find leader
    for (let port of replicas) {
        try {
            const res = await http.post(`http://localhost:${port}/stroke`, stroke);

            if (res.data.status === "committed") {
                currentLeader = port;
                console.log(`Leader set → ${port}`);
                return true;
            }
        } catch {}
    }

    // 3️⃣ no leader
    console.log("No leader available (cluster down)");
    return false;
}

console.log("Gateway running on port 8080");