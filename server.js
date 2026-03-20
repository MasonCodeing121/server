const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs"); // Required to read the index.html file
const path = require("path"); // Required to find the file path

// 1. Create the HTTP server to serve the Admin Panel
const server = http.createServer((req, res) => {
    // When a browser visits the URL, send the index.html file
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            return res.end("Error: Ensure index.html is in the same folder as server.js");
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
    });
});

// 2. Initialize Socket.io on the same server
const io = new Server(server, {
    cors: {
        origin: true, // Allows game connections from other URLs
        methods: ["GET", "POST"]
    }
});

let rooms = {}; 
const ADMIN_PASSWORD = "123";

io.on("connection", (socket) => {
    const origin = socket.handshake.headers.origin || "Local/Unknown";

    // --- ADMIN LOGIC ---
    socket.on("admin-login", (pass) => {
        if (pass === ADMIN_PASSWORD) {
            socket.join("admin-group");
            socket.emit("admin-confirmed", rooms);
        } else {
            socket.emit("admin-denied");
        }
    });

    socket.on("admin-kick", (targetId) => {
        if (socket.rooms.has("admin-group")) {
            const target = io.sockets.sockets.get(targetId);
            if (target) target.disconnect();
        }
    });

    // --- GAME LOGIC (Matches your scripts.js) ---
    socket.on('room:join', (data) => {
        const { roomId, playerName } = data;
        socket.join(roomId);
        
        if (!rooms[roomId]) rooms[roomId] = {};
        
        rooms[roomId][socket.id] = {
            name: playerName || "Player",
            origin: origin,
            x: 0, y: 0, hp: 100
        };

        socket.emit('room:joined', { room: { id: roomId } });
        updateAdmins();
    });

    socket.on('game:event', (data) => {
        const { roomId, payload } = data;
        
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            rooms[roomId][socket.id] = { 
                ...rooms[roomId][socket.id], 
                ...payload 
            };

            socket.to(roomId).emit('game:event', {
                senderId: socket.id,
                payload: payload
            });

            updateAdmins();
        }
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach(roomId => {
            if (rooms[roomId] && rooms[roomId][socket.id]) {
                delete rooms[roomId][socket.id];
                io.to(roomId).emit('room:player_left', { player: { id: socket.id } });
                if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
            }
        });
        updateAdmins();
    });
});

function updateAdmins() {
    io.to("admin-group").emit("admin-update", rooms);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
