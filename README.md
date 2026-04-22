# 🧠 Mini-RAFT Distributed Drawing Board

A fault-tolerant, real-time collaborative drawing application built using a **Mini-RAFT consensus protocol**.

This project simulates real-world distributed systems used in cloud infrastructure (like Kubernetes, etcd, Consul).

---

## 🚀 Features

- 🎨 Real-time collaborative drawing (WebSockets)
- 🧩 Distributed system with 3 replicas
- 🗳️ Leader election (RAFT-like)
- 📜 Log replication & consistency
- 🔄 Automatic failover handling
- ⚡ Zero-downtime replica reload
- 🔁 State synchronization on restart

---

## 🏗️ Architecture
            ┌──────────────┐
            │   Frontend   │
            │ (Canvas UI)  │
            └──────┬───────┘
                   │ WebSocket
            ┌──────▼───────┐
            │   Gateway    │
            │ (Router)     │
            └──────┬───────┘
   ┌───────────────┼───────────────┐
   ▼               ▼               ▼
┌────────┐     ┌────────┐      ┌────────┐
│Replica1│     │Replica2│      │Replica3│
│(RAFT) │       │(RAFT) │      │(RAFT) │
└────────┘     └────────┘      └────────┘


---

## ⚙️ Components

### 🎨 Frontend
- HTML Canvas-based UI
- Real-time drawing using mouse/touch
- Receives updates via WebSocket

---

### 🌐 Gateway (WebSocket Server)
- Handles all client connections
- Routes drawing events to leader
- Broadcasts committed strokes
- Detects leader changes and re-routes dynamically

---

### 🧩 Replica Nodes (3 instances)

Each replica implements a **Mini-RAFT protocol**:

#### States
- Follower
- Candidate
- Leader

#### Responsibilities
- Maintain append-only stroke log
- Participate in leader election
- Replicate logs across cluster
- Commit entries on majority agreement
- Sync logs after restart

#### RPC Endpoints
- `/request-vote`
- `/append-entries`
- `/heartbeat`
- `/sync-log`

---

## 🧠 Mini-RAFT Protocol

### Leader Election
- Timeout: 500–800ms
- Follower → Candidate if heartbeat missing
- Majority votes → Leader

### Heartbeat
- Interval: 150ms

### Log Replication
1. Client → Gateway → Leader
2. Leader appends to log
3. Sends to followers
4. Majority confirms
5. Entry committed
6. Broadcast to clients

### Safety Guarantees
- No overwriting committed logs
- Higher term always wins
- Majority quorum required

---

## 🔄 Fault Tolerance

✔ Leader crash → automatic re-election  
✔ Replica restart → state sync  
✔ Hot reload → zero downtime  
✔ Multiple failures → system still consistent  

---

## 🐳 Running the Project

### 1. Clone Repo

```bash
git clone https://github.com/sh051/raft-drawing-board
cd raft-drawing-board

docker-compose up --build


http://localhost:<frontend-port>
