const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: true,
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

    // --- GAME LOGIC ---
    socket.on('room:join', (data) => {
        const { roomId, playerName } = data;
        socket.join(roomId);
        
        if (!rooms[roomId]) rooms[roomId] = {};
        
        // Initialize player data
        rooms[roomId][socket.id] = {
            name: playerName || "Player",
            x: 0, y: 0, hp: 100,
            moving: false, dir: "down", swinging: false
        };

        console.log(`User ${socket.id} joined room: ${roomId}`);
        socket.emit('room:joined', { room: { id: roomId } });
        updateAdmins();
    });

    socket.on('game:event', (data) => {
        const { roomId, payload } = data;
        
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            // Update server record
            rooms[roomId][socket.id] = { 
                ...rooms[roomId][socket.id], 
                ...payload 
            };

            // Broadcast movement/actions to everyone else in the room
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
