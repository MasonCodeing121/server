const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

// 1. CREATE THE HTTP SERVER
// This part handles serving the Admin Panel (index.html) to your browser
const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            return res.end("Error: index.html not found in server directory.");
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
    });
});

// 2. INITIALIZE SOCKET.IO
const io = new Server(server, {
    cors: {
        origin: true, // Allows your game to connect from other URLs
        methods: ["GET", "POST"]
    }
});

// Main data structure for rooms and players
let rooms = {}; 
const ADMIN_PASSWORD = "Sb226698*"; 

io.on("connection", (socket) => {
    const origin = socket.handshake.headers.origin || "Local/Unknown";
    console.log(`New connection: ${socket.id} from ${origin}`);

    // --- ADMIN PANEL LOGIC ---
    socket.on("admin-login", (pass) => {
        if (pass === ADMIN_PASSWORD) {
            socket.join("admin-group");
            socket.emit("admin-confirmed", rooms);
            console.log(`Admin access granted to: ${socket.id}`);
        } else {
            socket.emit("admin-denied");
        }
    });

    socket.on("admin-kick", (targetId) => {
        // Only allow kicking if the sender is in the admin group
        if (socket.rooms.has("admin-group")) {
            const target = io.sockets.sockets.get(targetId);
            if (target) {
                target.disconnect();
                console.log(`Admin kicked player: ${targetId}`);
            }
        }
    });

    // --- GAME LOGIC (Matches your scripts.js) ---
    
    // Triggered when a player joins a multiplayer room
    socket.on('room:join', (data) => {
        const { roomId, playerName } = data;
        socket.join(roomId);
        
        if (!rooms[roomId]) rooms[roomId] = {};
        
        // Save player details for the Admin Panel to see
        rooms[roomId][socket.id] = {
            name: playerName || "Player",
            origin: origin,
            x: 0, 
            y: 0, 
            hp: 100,
            moving: false,
            dir: "down"
        };

        console.log(`Player ${socket.id} joined room: ${roomId}`);
        
        // Tell the player they successfully joined
        socket.emit('room:joined', { room: { id: roomId } });
        
        // Refresh the Admin Panel
        refreshAdmins();
    });

    // Triggered by the game loop in scripts.js
    socket.on('game:event', (data) => {
        const { roomId, payload } = data;
        
        if (rooms[roomId] && rooms[roomId][socket.id]) {
            // Update our server record for the Admin Panel
            rooms[roomId][socket.id] = { 
                ...rooms[roomId][socket.id], 
                ...payload 
            };

            // Send this movement to everyone else in the room
            socket.to(roomId).emit('game:event', {
                senderId: socket.id,
                payload: payload
            });

            // Keep Admin Panel updated (optional: throttled)
            refreshAdmins();
        }
    });

    // Handle Disconnection
    socket.on("disconnecting", () => {
        socket.rooms.forEach(roomId => {
            if (rooms[roomId] && rooms[roomId][socket.id]) {
                delete rooms[roomId][socket.id];
                
                // Tell other players in the room to remove this character
                io.to(roomId).emit('room:player_left', { player: { id: socket.id } });
                
                // Clean up empty rooms
                if (Object.keys(rooms[roomId]).length === 0) {
                    delete rooms[roomId];
                }
            }
        });
        refreshAdmins();
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Helper function to sync all logged-in admins
function refreshAdmins() {
    io.to("admin-group").emit("admin-update", rooms);
}

// 3. START THE SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cutter RPG Server is live on port ${PORT}`);
});
