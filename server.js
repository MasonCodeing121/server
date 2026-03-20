const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: true, // Allows multiple URLs (like your Render game) to connect
        methods: ["GET", "POST"]
    }
});

// Main data structure to match your game's room-based logic
let rooms = {}; 
const ADMIN_PASSWORD = "123"; // Use this in your Admin Panel

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
    
    // Triggered when you hit "MULTIPLAYER" or "CREATE SERVER" in your game
    socket.on('room:join', (data) => {
        const { roomId, playerName } = data;
        socket.join(roomId);
        
        if (!rooms[roomId]) rooms[roomId] = {};
        
        // Initialize player data structure
        rooms[roomId][socket.id] = {
            name: playerName || "Player",
            origin: origin,
            x: 0, y: 0, hp: 100
        };

        console.log(`User ${socket.id} joined room: ${roomId}`);
        socket.emit('room:joined', { room: { id: roomId } }); // Notify game client
        updateAdmins();
    });

    // Triggered by your game's movement loop
    socket.on('game:event', (data) => {
        const { roomId, payload } = data;
        
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            // Update the server's record of this player
            rooms[roomId][socket.id] = { 
                ...rooms[roomId][socket.id], 
                ...payload 
            };

            // Broadcast to other players in the same room
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
                // Notify game clients
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