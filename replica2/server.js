const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ===== RAFT STATE =====
let state = "follower";
let term = 0;
let votedFor = null;
let votes = 0;

const PORT = 5002;

// ===== LOG =====
let log = [];

// ===== PEERS =====
const peers = [
    "http://localhost:5001",
    "http://localhost:5002",
    "http://localhost:5003"
];

// ===== CLIENT WRITE (ONLY LEADER) =====
app.post("/stroke", async (req, res) => {
    if (state !== "leader") {
        return res.status(403).json({ error: "Not leader" });
    }

    const stroke = req.body;
    log.push(stroke);

    let successCount = 1;

    for (let peer of peers) {
        if (peer.includes(PORT)) continue;

        try {
            await axios.post(peer + "/replicate", stroke);
            successCount++;
        } catch {}
    }

    if (successCount >= 2) {
        console.log(`Node ${PORT} COMMITTED`);
        return res.json({ status: "committed" });
    } else {
        console.log(`Node ${PORT} FAILED commit`);
        return res.status(500).json({ error: "Commit failed" });
    }
});

// ===== FOLLOWER REPLICATION =====
app.post("/replicate", (req, res) => {
    const stroke = req.body;
    log.push(stroke);
    res.json({ status: "ok" });
});

// ===== SYNC LOG =====
app.post("/sync-log", (req, res) => {
    const { fromIndex } = req.body;

    const missing = log.slice(fromIndex);

    res.json({
        entries: missing,
        length: log.length
    });
});

// ===== DEBUG =====
app.get("/log", (req, res) => {
    res.json(log);
});

// ===== TIMEOUT =====
function getRandomTimeout() {
    return Math.floor(Math.random() * 500) + 1000; 
    // 1000–1500 ms
}

let electionTimeout;

function resetElectionTimeout() {
    clearTimeout(electionTimeout);

    electionTimeout = setTimeout(() => {
        if (state !== "leader") {
            startElection();
        }
    }, getRandomTimeout());
}

// ⏳ Delay election start (important)
setTimeout(() => {
    resetElectionTimeout();
}, 1500);

// ===== START ELECTION =====
function startElection() {
    if (state === "leader") return;

    state = "candidate";
    term++;
    votedFor = PORT;
    votes = 1;

    console.log(`Node ${PORT} election (term ${term})`);

    peers.forEach(async (peer) => {
        if (peer.includes(PORT)) return;

        try {
            const res = await axios.post(peer + "/request-vote", {
                term,
                candidateId: PORT
            });

            if (res.data.voteGranted) {
                votes++;

                if (votes >= 2 && state === "candidate") {
                    becomeLeader();
                }
            }
        } catch {}
    });

    resetElectionTimeout();
}

// ===== REQUEST VOTE =====
app.post("/request-vote", (req, res) => {
    const { term: incomingTerm, candidateId } = req.body;

    if (incomingTerm > term) {
        term = incomingTerm;
        votedFor = null;
        state = "follower";
    }

    if ((!votedFor || votedFor === candidateId) && incomingTerm >= term) {
        votedFor = candidateId;
        resetElectionTimeout();
        return res.json({ voteGranted: true });
    }

    res.json({ voteGranted: false });
});

// ===== BECOME LEADER =====
function becomeLeader() {
    if (state !== "candidate") return;

    state = "leader";
    console.log(`Node ${PORT} LEADER (term ${term})`);

    startHeartbeat();
}

// ===== HEARTBEAT =====
function startHeartbeat() {
    setInterval(async () => {
        if (state !== "leader") return;

        peers.forEach(async (peer) => {
            if (peer.includes(PORT)) return;

            try {
                await axios.post(peer + "/heartbeat", {
                    term,
                    leaderId: PORT
                });
            } catch {}
        });
    }, 150);
}

// ===== RECEIVE HEARTBEAT (FINAL FIX) =====
app.post("/heartbeat", (req, res) => {
    const { term: incomingTerm } = req.body;

    if (incomingTerm >= term) {
        term = incomingTerm;

        if (state !== "follower") {
            console.log(`Node ${PORT} stepping down`);
        }

        state = "follower";
        votedFor = null;

        // 🔥 KEY FIX: only reset timeout when valid heartbeat
        resetElectionTimeout();
    }

    res.json({ status: "ok" });
});

// ===== SYNC ON START =====
async function syncWithCluster() {
    for (let peer of peers) {
        if (peer.includes(PORT)) continue;

        try {
            const res = await axios.post(peer + "/sync-log", {
                fromIndex: log.length
            });

            log = log.concat(res.data.entries);

            console.log(`Node ${PORT} synced`);
            break;
        } catch {}
    }
}

setTimeout(syncWithCluster, 2000);

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`Replica running on ${PORT}`);
});