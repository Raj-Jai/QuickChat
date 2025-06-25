const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// roomID -> { users: [{ id, username, userID }], messages: [] }
const rooms = new Map();
// userID -> socket.id
const userMap = new Map();

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register-user', (userID) => {
    socket.userID = userID;
    userMap.set(userID, socket.id);
    console.log(`User registered: ${userID} => ${socket.id}`);
  });

  socket.on('create-room', (roomID, cb) => {
    if (rooms.has(roomID)) return cb({ success: false, message: 'Room already exists!' });
    rooms.set(roomID, { users: [], messages: [] });
    cb({ success: true });
  });

  socket.on('join-room', ({ roomID, username }, cb) => {
  const room = rooms.get(roomID);
  if (!room) return cb({ success: false, message: 'Room does not exist!' });

  socket.join(roomID);
  socket.roomID = roomID;
  socket.username = username;

  room.users.push({ id: socket.id, username, userID: socket.userID });
  cb({ success: true });

  io.to(roomID).emit('update-users', room.users.map((u) => u.username)); // ✅ Add this line
  socket.emit('previous-messages', room.messages);
});

  socket.on('send-message', ({ roomID, message, username, timestamp }) => {
    const room = rooms.get(roomID);
    if (!room) return;

    const msg = { username, message, timestamp };
    room.messages.push(msg);
    if (room.messages.length > 100) room.messages.shift();

    socket.to(roomID).emit('receive-message', msg);
  });

  socket.on('typing', ({ roomID, username, typing }) => {
    if (typing) {
      socket.to(roomID).emit('user-typing', username);
    } else {
      socket.to(roomID).emit('user-stopped-typing', username);
    }
  });

  const cleanupUser = (id) => {
    for (const [roomID, room] of rooms) {
      room.users = room.users.filter((u) => u.id !== id);
      if (room.users.length === 0) {
        rooms.delete(roomID);
        console.log('Room deleted:', roomID);
      } else {
        io.to(roomID).emit('update-users', room.users.map((u) => u.username));
      }
    }
  };

  socket.on('leave-room', () => cleanupUser(socket.id));
  socket.on('disconnect', () => {
    cleanupUser(socket.id);
    if (socket.userID) userMap.delete(socket.userID);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
