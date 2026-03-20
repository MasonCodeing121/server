const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

// 1. HTTP Server: Serves the Admin Panel (index.html)
const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            return res.end("Error: index.html not found.");
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
    });
});

// 2. Socket.io Setup
const io = new Server(server, {
    cors: { origin: true, methods: ["GET", "POST"] }
});

let rooms = {}; 
const ADMIN_PASSWORD = "123"; // Change this for security!

io.on("connection", (socket) => {
    const origin = socket.handshake.headers.origin || "Unknown Origin";

    // --- ADMIN LOGIC ---
    socket.on("admin-login", (pass) => {
        if (pass === ADMIN_PASSWORD) {
            socket.join("admin-group");
            socket.emit("admin-confirmed", rooms);
            sendLog("system", `Admin logged in from ${origin}`);
        } else {
            socket.emit("admin-denied");
        }
    });

    socket.on("admin-kick", (targetId) => {
        if (socket.rooms.has("admin-group")) {
            const target = io.sockets.sockets.get(targetId);
            if (target) {
                sendLog("leave", `Admin KICKED player: ${targetId}`);
                target.disconnect();
            }
        }
    });

    socket.on("admin-broadcast", (msg) => {
        if (socket.rooms.has("admin-group")) {
            io.emit("game-msg", msg); // You can add a listener in scripts.js for this
            sendLog("system", `BROADCAST: ${msg}`);
        }
    });

    // --- GAME LOGIC (Syncs with your scripts.js) ---
    socket.on('room:join', (data) => {
        const { roomId, playerName } = data;
        socket.join(roomId);
        
        if (!rooms[roomId]) rooms[roomId] = {};
        
        rooms[roomId][socket.id] = {
            name: playerName || "Player",
            x: 0, y: 0, hp: 100, wood: 0, leaves: 0, gel: 0,
            moving: false, dir: "down", origin: origin
        };

        socket.emit('room:joined', { room: { id: roomId } });
        sendLog("join", `${playerName || socket.id} joined room: ${roomId}`);
        updateAdmins();
    });

    socket.on('game:event', (data) => {
        const { roomId, payload } = data;
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            rooms[roomId][socket.id] = { ...rooms[roomId][socket.id], ...payload };
            socket.to(roomId).emit('game:event', { senderId: socket.id, payload: payload });
            updateAdmins();
        }
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach(roomId => {
            if (rooms[roomId] && rooms[roomId][socket.id]) {
                const name = rooms[roomId][socket.id].name;
                delete rooms[roomId][socket.id];
                sendLog("leave", `${name || socket.id} disconnected from ${roomId}`);
                io.to(roomId).emit('room:player_left', { player: { id: socket.id } });
                if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
            }
        });
        updateAdmins();
    });
});

function updateAdmins() { io.to("admin-group").emit("admin-update", rooms); }

function sendLog(type, msg) {
    io.to("admin-group").emit("log-event", {
        type: type,
        msg: msg,
        time: new Date().toLocaleTimeString()
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
