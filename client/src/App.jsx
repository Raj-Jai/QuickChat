import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io(import.meta.env.VITE_SOCKET_SERVER_URL);

function App() {
  const [username, setUsername] = useState('');
  const [roomID, setRoomID] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [inRoom, setInRoom] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let userID = localStorage.getItem('userID');
    if (!userID) {
      userID = crypto.randomUUID();
      localStorage.setItem('userID', userID);
    }
    socket.emit('register-user', userID);
  }, []);

  useEffect(() => {
    socket.on('receive-message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('previous-messages', (backlog) => {
      setMessages(backlog || []);
    });

    socket.on('update-users', (userList) => {
      setUsers(userList);
    });

    socket.on('user-typing', (name) => {
      setTypingUsers((prev) => [...new Set([...prev, name])]);
    });

    socket.on('user-stopped-typing', (name) => {
      setTypingUsers((prev) => prev.filter((n) => n !== name));
    });

    return () => {
      socket.off('receive-message');
      socket.off('previous-messages');
      socket.off('update-users');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : '';
  }, [darkMode]);

const createRoom = () => {
  if (!username) return alert('Enter Username');

  const generatedRoomID = Math.random().toString(36).substring(2, 8); // short random ID
  setRoomID(generatedRoomID);

  socket.emit('create-room', generatedRoomID, (res) => {
    if (res.success) {
      joinRoom(generatedRoomID); // Pass the new ID
    } else {
      alert(res.message);
    }
  });
};



const joinRoom = (id) => {
  const finalRoomID = id || roomID; // fallback to typed-in ID
  if (!finalRoomID || !username) return alert('Enter Room ID and Username');

  socket.emit('join-room', { roomID: finalRoomID, username }, (res) => {
    if (res.success) setInRoom(true);
    else alert(res.message);
  });
};



  const leaveRoom = () => {
    socket.emit('leave-room');
    setInRoom(false);
    setMessages([]);
    setRoomID('');
    setUsers([]);
    setTypingUsers([]);
  };

  const sendMessage = () => {
    if (message.trim() === '') return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    socket.emit('send-message', { roomID, message, username, timestamp });
    setMessages((prev) => [...prev, { message, username: 'You', timestamp }]);
    setMessage('');
    socket.emit('typing', { roomID, username, typing: false });
  };

  const toggleTheme = () => setDarkMode((prev) => !prev);

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit('typing', { roomID, username, typing: e.target.value.length > 0 });
  };

  if (!inRoom) {
    return (
      <div className={`login-container ${darkMode ? 'dark' : ''}`}>
  <h1>QuickChat-Real-Time Chat</h1>

  <input
    type="text"
    placeholder="Your Name"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    className="login-input"
  />

  <button className="create-btn" onClick={createRoom}>
    <span style={{ marginRight: '8px' }}>➕</span> Create New Session
  </button>

  <div className="join-section">
    <input
      type="text"
      placeholder="Enter Room ID"
      value={roomID}
      onChange={(e) => setRoomID(e.target.value)}
      className="login-input"
    />
    <button className="join-btn" onClick={() => joinRoom()}>
      <span style={{ marginRight: '6px' }}>🗝️</span> Join
    </button>
  </div>

  <button className="toggle-btn" onClick={toggleTheme} style={{ marginTop: '10px' }}>
    {darkMode ? 'Light' : 'Dark'} Mode
  </button>
</div>

    );
  }

  return (
    <div className={`chat-wrapper ${darkMode ? 'dark' : ''}`}>
      <header className="chat-header">
       <div> <h2>
  Room: {roomID}
  <button
    onClick={() => navigator.clipboard.writeText(roomID)}
    style={{
      marginLeft: '10px',
      fontSize: '0.8rem',
      padding: '2px 6px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: 'none',
      background: '#444',
      color: 'white'
    }}
  >
    Copy
  </button>
</h2>

        <p className="user-list">In room: {users.filter(name => name !== username).join(', ') || 'Only you'}</p>

        </div>
        <span>Welcome, {username}</span>
       
        <div>
          <button className='toggle-btn' onClick={toggleTheme}>{darkMode ? 'Light' : 'Dark'} Mode</button>
          <button className='leave-btn' onClick={leaveRoom} style={{ marginLeft: '10px' }}>Leave Room</button>
        </div>
      

      </header>

      <main className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.username === 'You' ? 'self' : ''}`}>
            <strong>{msg.username} <small style={{ fontSize: '0.75rem', float: 'right' }}>{msg.timestamp}</small></strong>
            <p>{msg.message}</p>
          </div>
        ))}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">{typingUsers.join(', ')} typing...</div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={handleTyping}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </footer>
    </div>
  );
}

export default App;
