import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FaPlay, FaSyncAlt, FaSave, FaCopy, FaPlus, FaMinus, FaSignInAlt, FaSun, FaMoon, FaMicrophone, FaMicrophoneSlash, FaCommentDots, FaTimes, FaPaperPlane, FaLink, FaUpload } from 'react-icons/fa';
import './App.css';
import { nanoid } from 'nanoid';

const CollabEditor = lazy(() => import('./CollabEditor.jsx'));

// --- Theme Toggle Component ---
const ThemeToggle = ({ theme, setTheme }) => {
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <button onClick={toggleTheme} className="p-2 rounded-full bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/30 transition-colors">
      {theme === 'dark' ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-purple-400" />}
    </button>
  );
};


// --- Components for different pages ---

const HomePage = ({ theme, setTheme, profile, setProfile }) => {
  const [roomId, setRoomId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('syncpad:recentRooms') || '[]');
      setRecentRooms(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentRooms([]);
    }
    setLoaded(true);
  }, []);

  const normalizeRoomId = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/editor\/([^/]+)/);
      if (match?.[1]) return match[1];
    } catch {
      // ignore
    }
    return raw;
  };

  const createNewRoom = (e) => {
    e.preventDefault();
    const id = nanoid(6);
    window.location.href = `/editor/${id}`;
  };
  
  const joinRoom = () => {
    const normalized = normalizeRoomId(roomId);
    if (!normalized) {
      alert('Please enter a Room ID.');
      return;
    }
    window.location.href = `/editor/${normalized}`;
  };

  return (
    <div className={`relative flex items-center justify-center h-full w-full overflow-hidden ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>

      <div className={`p-10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 text-center transition-all duration-700 ease-out ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border`}>
        <h1 className={`text-8xl font-extrabold mb-4 transition-all duration-700 ease-out delay-100 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            SyncPad
          </span>
        </h1>
        <p className={`mb-8 transition-all duration-700 ease-out delay-200 ${loaded ? 'opacity-100' : 'opacity-0'} ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Collaborate in real-time. Code with anyone, anywhere.
        </p>

        <div className={`mb-6 transition-all duration-700 ease-out delay-250 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
          <label className={`block text-left text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Your display name</label>
          <input
            type="text"
            value={profile.username}
            onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
            onBlur={() => {
              const next = (profile.username || '').trim().slice(0, 32) || 'Anonymous';
              if (next !== profile.username) setProfile((p) => ({ ...p, username: next }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g. Akarsh"
            maxLength={32}
            className={`w-full p-3 rounded-xl focus:outline-none focus:ring-2 border transition-all ${theme === 'dark' ? 'bg-white/5 text-white placeholder-gray-500 focus:ring-purple-500 border-transparent focus:border-purple-500' : 'bg-white text-slate-900 placeholder-gray-400 focus:ring-purple-500 border-gray-200'}`}
          />
        </div>

        <div className={`flex flex-col space-y-5 transition-all duration-700 ease-out delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <button 
            onClick={createNewRoom} 
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all transform hover:scale-105"
          >
            <FaPlus className="mr-2"/> Create a New Room
          </button>
          <div className="flex items-center pt-4">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID to Join"
              className={`p-3 rounded-l-xl focus:outline-none focus:ring-2 flex-grow border transition-all ${theme === 'dark' ? 'bg-white/5 text-white placeholder-gray-500 focus:ring-purple-500 border-transparent focus:border-purple-500' : 'bg-white text-slate-900 placeholder-gray-400 focus:ring-purple-500 border-gray-200'}`}
              onKeyUp={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button 
              onClick={joinRoom} 
              className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-r-xl transition-colors"
            >
              <FaSignInAlt className="mr-2"/> Join
            </button>
          </div>
        </div>

        {recentRooms.length > 0 && (
          <div className={`mt-8 text-left transition-all duration-700 ease-out delay-400 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
            <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Recent rooms</p>
            <div className="flex flex-wrap gap-2">
              {recentRooms.slice(0, 6).map((id) => (
                <button
                  key={id}
                  onClick={() => (window.location.href = `/editor/${id}`)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EditorPage = ({ roomId, theme, setTheme, profile, setProfile }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  const [socket, setSocket] = useState(null);
  const [socketId, setSocketId] = useState('');
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [yjsStatus, setYjsStatus] = useState('connecting');

  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("Click 'Run' to see your code's output here.");
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [copyRoomText, setCopyRoomText] = useState('Copy');
  const [copyLinkText, setCopyLinkText] = useState('Share');

  const [wordWrap, setWordWrap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('syncpad:wrap') || 'true');
    } catch {
      return true;
    }
  });
  const [minimap, setMinimap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('syncpad:minimap') || 'false');
    } catch {
      return false;
    }
  });
  const [fontSize, setFontSize] = useState(() => {
    try {
      const n = Number(localStorage.getItem('syncpad:fontSize') || 14);
      return Number.isFinite(n) ? Math.min(24, Math.max(12, n)) : 14;
    } catch {
      return 14;
    }
  });
  
  // --- New Crazy Features State ---
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState([]);
  const messagesEndRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatOpenRef = useRef(false);
  const profileRef = useRef(profile);

  const [nameDraft, setNameDraft] = useState(profile.username || '');

  // --- Voice Chat State ---
  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(true);
  const peerConnections = useRef({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    profileRef.current = profile;
    setNameDraft(profile.username || '');
  }, [profile]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('syncpad:wrap', JSON.stringify(wordWrap));
      localStorage.setItem('syncpad:minimap', JSON.stringify(minimap));
      localStorage.setItem('syncpad:fontSize', String(fontSize));
    } catch {
      // ignore
    }
  }, [wordWrap, minimap, fontSize]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('update_profile', {
      roomId,
      user: { username: profile.username, color: profile.color },
    });
  }, [socket, roomId, profile.username, profile.color]);

  useEffect(() => {
    // Track recents (used on the homepage)
    try {
      const key = 'syncpad:recentRooms';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      const next = [roomId, ...(Array.isArray(prev) ? prev : []).filter((id) => id !== roomId)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const s = io.connect(backendUrl);
    setSocket(s);
    setSocketStatus('connecting');

    const onConnect = () => {
      setSocketId(s.id);
      setSocketStatus('connected');
      const p = profileRef.current || { username: '', color: '' };
      s.emit('join_room', { roomId, user: { username: p.username, color: p.color } });
    };

    const onDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const onConnectError = () => {
      setSocketStatus('disconnected');
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    s.on('room_update', (connectedClients) => {
      setClients(connectedClients);
      // If voice chat is active, create connections for new users
      if (localStreamRef.current) {
        const newClients = connectedClients.filter(
          (client) => client.id !== s.id && !peerConnections.current[client.id]
        );
        newClients.forEach((client) => {
          createPeerConnection(client.id, localStreamRef.current, true, s);
        });
      }
    });

    // --- WebRTC Signaling Listeners ---
    s.on('webrtc_offer', (data) => handleOffer(data, s));
    s.on('webrtc_answer', handleAnswer);
    s.on('webrtc_ice_candidate', handleIceCandidate);

    // --- Crazy Features Listeners ---
    s.on('receive_reaction', (reaction) => {
      handleShowReaction(reaction);
    });
    s.on('receive_chat', (msgData) => {
      setChatMessages(prev => [...prev, { ...msgData, isMe: false }]);
      if (!chatOpenRef.current) setUnreadCount((c) => c + 1);
    });

    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      setRemoteStreams({});
      setClients([]);

      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.disconnect();
    };
  }, [roomId]); // Removed localStream to prevent socket reconnection

  // --- WebRTC Logic ---
  const startVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setIsMuted(false);
      
      const otherUsers = clients.filter(client => client.id !== socketId);
      otherUsers.forEach(user => {
        createPeerConnection(user.id, stream, true, socket);
      });

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const createPeerConnection = (remoteSocketId, stream, isInitiator, socketInstance) => {
    if (peerConnections.current[remoteSocketId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = event => {
      if (event.candidate && socketInstance) {
        socketInstance.emit('webrtc_ice_candidate', { to: remoteSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = event => {
      setRemoteStreams(prev => ({ ...prev, [remoteSocketId]: event.streams[0] }));
    };

    if (isInitiator && socketInstance) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketInstance.emit('webrtc_offer', { to: remoteSocketId, sdp: pc.localDescription });
        });
    }
    
    peerConnections.current[remoteSocketId] = pc;
  };
  
  const handleOffer = ({ sdp, from }, socketInstance) => {
    const stream = localStreamRef.current;
    if (stream) {
        createPeerConnection(from, stream, false, socketInstance);
        const pc = peerConnections.current[from];
        if (pc) {
          pc.setRemoteDescription(new RTCSessionDescription(sdp))
          .then(() => pc.createAnswer())
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
              if (socketInstance) {
                  socketInstance.emit('webrtc_answer', { to: from, sdp: pc.localDescription });
              }
          });
        }
    }
  };
  
  const handleAnswer = ({ sdp, from }) => {
    const pc = peerConnections.current[from];
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  };

  const handleIceCandidate = ({ candidate, from }) => {
    const pc = peerConnections.current[from];
    if (pc && candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const toggleMute = () => {
    if(localStream){
        localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
        setIsMuted(!localStream.getAudioTracks()[0].enabled);
    }
  };

  const otherClients = clients.filter(client => client && client.id !== socketId);

  const getCurrentCode = () => editorRef.current?.getCode?.() ?? '';

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopyRoomText('Copied!');
      setTimeout(() => setCopyRoomText('Copy'), 2000);
    } catch {
      setCopyRoomText('Failed');
      setTimeout(() => setCopyRoomText('Copy'), 2000);
    }
  };

  const handleCopyInviteLink = async () => {
    const link = `${window.location.origin}/editor/${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyLinkText('Copied!');
      setTimeout(() => setCopyLinkText('Share'), 2000);
    } catch {
      setCopyLinkText('Failed');
      setTimeout(() => setCopyLinkText('Share'), 2000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click?.();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      editorRef.current?.setCode?.(text);
      editorRef.current?.focus?.();
    } catch {
      // ignore
    } finally {
      e.target.value = '';
    }
  };
  
  const handleRun = async () => {
    setIsLoading(true);
    setOutput("Running code...");
    try {
      const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      const response = await axios.post(`${API_URL}/api/run`, { language, code: getCurrentCode() });
      setOutput(response.data?.output ?? '');
    } catch (error) {
      setOutput(error.response?.data?.output || error.message || "Failed to run code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    const fileExtensions = { javascript: 'js', python: 'py', cpp: 'cpp' };
    const blob = new Blob([getCurrentCode()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const extension = fileExtensions[language] || 'txt';
    link.download = `code.${extension}`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = { handleSave, handleRun, handleCopyInviteLink };
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target;
      const tag = target?.tagName?.toLowerCase?.();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
      if (isTyping) return;

      const isMod = e.ctrlKey || e.metaKey;
      const key = (e.key || '').toLowerCase();

      if (isMod && key === 's') {
        e.preventDefault();
        actionsRef.current.handleSave?.();
      }
      if (isMod && key === 'enter') {
        e.preventDefault();
        actionsRef.current.handleRun?.();
      }
      if (isMod && e.shiftKey && key === 'c') {
        e.preventDefault();
        actionsRef.current.handleCopyInviteLink?.();
      }
      if (isMod && e.shiftKey && key === 'l') {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- Crazy Features Logic ---
  const handleShowReaction = (emoji) => {
    const id = nanoid();
    const left = Math.floor(Math.random() * 80) + 10;
    setReactions(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const sendReaction = (emoji) => {
    handleShowReaction(emoji);
    if (socket) socket.emit("reaction", { room: roomId, reaction: emoji });
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msgData = { text: chatInput, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    const myUsername = (profile.username || 'You').trim() || 'You';
    const myColor = profile.color || '#8b5cf6';
    setChatMessages(prev => [...prev, { ...msgData, user: { username: myUsername, color: myColor }, isMe: true }]);
    if (socket) socket.emit("chat_message", { room: roomId, ...msgData });
    setChatInput('');
  };

  const myColor = profile.color || '#8b5cf6';
  const myInitial = (profile.username || 'You').trim().charAt(0).toUpperCase() || 'Y';

  const isLive = socketStatus === 'connected' && yjsStatus === 'connected';
  const liveLabel = isLive ? 'Live' : socketStatus !== 'connected' ? 'Offline' : yjsStatus !== 'connected' ? 'Syncing' : 'Connecting';
  const liveDotClass = isLive
    ? 'bg-emerald-400'
    : socketStatus !== 'connected'
      ? 'bg-red-400'
      : 'bg-amber-400 animate-pulse';

  const commitDisplayName = () => {
    const next = (nameDraft || '').trim().slice(0, 32) || 'Anonymous';
    const current = (profile.username || '').trim() || 'Anonymous';
    if (next === current) return;
    setProfile((p) => ({ ...p, username: next }));
  };
  

  return (
    <div className={`fixed inset-0 flex flex-col font-sans overflow-hidden ${theme === 'light' ? 'text-slate-900' : 'text-gray-100'}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.js,.jsx,.ts,.tsx,.py,.cpp,.c,.h,.hpp"
        className="hidden"
        onChange={handleImportFile}
      />

      <header className={`flex items-center justify-between p-3 shadow-lg border-b z-20 flex-shrink-0 ${theme === 'dark' ? 'bg-black/30 backdrop-blur-lg border-white/10' : 'bg-white/70 backdrop-blur-lg border-gray-200'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">SyncPad</h1>
          <div className={`hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg border text-xs ${theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
            <span className={`w-2 h-2 rounded-full ${liveDotClass}`} />
            <span className="font-semibold">{liveLabel}</span>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>• {clients.length}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`hidden md:flex items-center space-x-2 p-1 pr-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Room:</p>
            <span className={`font-mono py-0.5 px-2 rounded ${theme === 'dark' ? 'text-white bg-gray-800' : 'text-slate-900 bg-white border border-gray-200'}`}>{roomId}</span>
            <button onClick={handleCopyRoomId} title="Copy Room ID" className={`flex items-center px-2 py-1 rounded-md transition-colors ${theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'}`}>
              <FaCopy />
              <span className="hidden lg:inline ml-1">{copyRoomText}</span>
            </button>
            <button onClick={handleCopyInviteLink} title="Copy Invite Link" className={`flex items-center px-2 py-1 rounded-md transition-colors ${theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'}`}>
              <FaLink />
              <span className="hidden lg:inline ml-1">{copyLinkText}</span>
            </button>
          </div>

          <div className="hidden sm:flex -space-x-3">
            {otherClients.map((client) => (
              client && (
                <div
                  key={client.id}
                  title={client.username}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold border-2 ${theme === 'dark' ? 'border-black/50' : 'border-white/50'}`}
                  style={{ backgroundColor: client.color }}
                >
                  {client.username.substring(0, 1)}
                </div>
              )
            ))}
          </div>

          <div className={`hidden lg:flex items-center gap-2 px-2 py-1 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: myColor }}
              title="You"
            >
              {myInitial}
            </div>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitDisplayName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setNameDraft(profile.username || '');
                  e.currentTarget.blur();
                }
              }}
              placeholder="Your name"
              maxLength={32}
              className={`text-sm bg-transparent outline-none w-40 ${theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-slate-900 placeholder-gray-500'}`}
            />
          </div>

          <ThemeToggle theme={theme} setTheme={setTheme} />

          {/* Voice Chat Controls */}
          <div className="flex items-center space-x-2">
            {!localStream ? (
              <button
                onClick={startVoiceChat}
                title="Start Voice Chat"
                className="flex items-center p-2 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/40 transition-colors"
              >
                <FaMicrophone />
              </button>
            ) : (
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                className={`flex items-center p-2 rounded-full transition-colors ${
                  isMuted
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/40'
                }`}
              >
                {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
              </button>
            )}
          </div>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            title="Toggle Chat"
            className={`relative flex items-center justify-center p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <FaCommentDots className={chatOpen ? 'text-blue-500' : ''} />
            {!chatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>
      
      <div className={`flex items-center justify-between p-2 border-b z-10 flex-shrink-0 ${theme === 'dark' ? 'bg-black/20 backdrop-blur-lg border-white/10' : 'bg-white/50 backdrop-blur-lg border-gray-200'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <label htmlFor="language-select" className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Language:</label>
          <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} className={`border rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-200 border-gray-300'}`}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>

          <div className={`hidden md:flex items-center gap-2 ml-2 pl-3 border-l ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}>
            <button
              onClick={handleImportClick}
              title="Import a file into the room"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              <FaUpload />
              <span className="hidden lg:inline">Import</span>
            </button>
            <button
              onClick={() => setWordWrap((w) => !w)}
              title="Toggle word wrap"
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Wrap: {wordWrap ? 'On' : 'Off'}
            </button>
            <button
              onClick={() => setMinimap((m) => !m)}
              title="Toggle minimap"
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Minimap: {minimap ? 'On' : 'Off'}
            </button>
            <div className={`flex items-center gap-1 px-2 py-1.5 rounded-md ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}>
              <button
                onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                title="Decrease font size"
                className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-300'}`}
              >
                <FaMinus className="text-xs" />
              </button>
              <span className={`text-xs w-12 text-center ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{fontSize}px</span>
              <button
                onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                title="Increase font size"
                className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-300'}`}
              >
                <FaPlus className="text-xs" />
              </button>
            </div>
          </div>

          <div className={`hidden xl:flex ml-4 border-l pl-4 items-center space-x-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}>
            <button onClick={() => sendReaction('🚀')} className={`p-1.5 rounded-full hover:scale-125 transition-transform ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>🚀</button>
            <button onClick={() => sendReaction('🔥')} className={`p-1.5 rounded-full hover:scale-125 transition-transform ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>🔥</button>
            <button onClick={() => sendReaction('🤯')} className={`p-1.5 rounded-full hover:scale-125 transition-transform ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>🤯</button>
            <button onClick={() => sendReaction('💖')} className={`p-1.5 rounded-full hover:scale-125 transition-transform ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>💖</button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleSave} className={`flex items-center font-semibold py-1.5 px-4 rounded-md shadow-md transition-all duration-200 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-slate-800'}`}>
            <FaSave className="mr-2" /> Save
          </button>
          <button onClick={handleRun} disabled={isLoading} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-4 rounded-md shadow-lg shadow-blue-600/30 transform hover:scale-105 transition-all duration-200 disabled:bg-gray-600 disabled:shadow-none disabled:cursor-not-allowed">
            {isLoading ? (<FaSyncAlt className="animate-spin mr-2" />) : (<FaPlay className="mr-2" />)}
            {isLoading ? "Running..." : "Run"}
          </button>
        </div>
      </div>
      <div className={`flex flex-1 relative min-h-0 ${theme === 'dark' ? 'bg-black/30' : ''}`}>
        
        {/* Editor & Output (Main Area) */}
        <div className="flex-1 min-w-0 min-h-0 p-4">
          <PanelGroup
            direction="vertical"
            className={`h-full w-full rounded-lg overflow-hidden shadow-2xl border ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}
          >
            <Panel minSize={10} className="min-h-0">
              <div className="h-full min-h-0">
                <Suspense
                  fallback={
                    <div className={`h-full w-full flex items-center justify-center ${theme === 'dark' ? 'bg-black/20 text-gray-200' : 'bg-white text-slate-800'}`}>
                      Loading editor...
                    </div>
                  }
                >
                  <CollabEditor
                    ref={editorRef}
                    roomId={roomId}
                    currentUser={{ id: socketId || 'local', name: (profile.username || 'Anonymous'), color: profile.color }}
                    language={language}
                    theme={theme}
                    editorOptions={{
                      wordWrap: wordWrap ? 'on' : 'off',
                      minimap: { enabled: minimap },
                      fontSize,
                    }}
                    onStatus={(status) => setYjsStatus(status)}
                  />
                </Suspense>
              </div>
            </Panel>
            <PanelResizeHandle
              className={`h-2 hover:bg-blue-600 transition-colors duration-200 cursor-row-resize flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}
            >
              <div className={`w-8 h-1 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-400'}`} />
            </PanelResizeHandle>
            <Panel defaultSize={20} minSize={10} className="min-h-0">
              <div className={`h-full p-4 overflow-auto font-mono text-sm ${theme === 'dark' ? 'bg-black/30' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-md font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Output</h2>
                  <button
                    onClick={() => setOutput('')}
                    className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                  >
                    Clear
                  </button>
                </div>
                <pre className={theme === 'dark' ? 'text-gray-200' : 'text-slate-800'}>{output}</pre>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Chat Panel Side */}
        {chatOpen && (
          <div className={`w-80 h-full flex flex-col border-l shadow-2xl absolute right-0 top-0 bottom-0 ${theme === 'dark' ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-300'} z-30`}>
            <div className="flex items-center justify-between p-3 border-b border-inherit bg-black/10">
              <h3 className="font-bold flex items-center"><FaCommentDots className="mr-2"/> Live Chat</h3>
              <button onClick={() => setChatOpen(false)} className="hover:text-red-500"><FaTimes /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm mt-10">No messages yet. Say hi! 👋</div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-500 mb-1 flex items-center space-x-1">
                      {!msg.isMe && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: msg.user.color }}></span>}
                      <span>{msg.user.username} • {msg.time}</span>
                    </span>
                    <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm shadow ${msg.isMe ? 'bg-blue-600 text-white rounded-br-none' : (theme === 'dark' ? 'bg-gray-800 text-white rounded-bl-none' : 'bg-gray-100 text-slate-800 rounded-bl-none')}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendChat} className={`p-3 border-t border-inherit flex ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className={`flex-1 rounded-l-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-800 text-white placeholder-gray-400 border border-gray-700' : 'bg-gray-100 text-slate-800 border border-gray-300'}`}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-r-lg"><FaPaperPlane /></button>
            </form>
          </div>
        )}

      </div>

      {/* Floating Reactions overlay */}
      {reactions.map(r => (
        <div key={r.id} className="floating-emoji" style={{ left: `${r.left}%` }}>{r.emoji}</div>
      ))}

      {/* --- Audio elements to play remote streams --- */}
      {Object.entries(remoteStreams).map(([socketId, stream]) => (
        <audio key={socketId} autoPlay ref={audio => { if (audio) audio.srcObject = stream; }} />
      ))}
    </div>
  );
};

// --- Main App Component ---
function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('syncpad:theme') || localStorage.getItem('theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [profile, setProfile] = useState(() => {
    let username = '';
    let color = '';
    try {
      username = localStorage.getItem('syncpad:username') || '';
      color = localStorage.getItem('syncpad:color') || '';
    } catch {
      // ignore
    }

    if (!username.trim()) username = 'Anonymous';

    const palette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA', '#8b5cf6', '#3b82f6'];
    if (!color) color = palette[Math.floor(Math.random() * palette.length)];

    return { username, color };
  });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
      root.classList.remove('light');
        } else {
            root.classList.remove('dark');
      root.classList.add('light');
        }
    try {
      localStorage.setItem('syncpad:theme', theme);
    } catch {
      // ignore
    }
    }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('syncpad:username', profile.username || '');
      localStorage.setItem('syncpad:color', profile.color || '');
    } catch {
      // ignore
    }
  }, [profile]);
  
  const path = window.location.pathname;
  
  if (path.startsWith('/editor/')) {
    const roomId = path.split('/editor/')[1];
    return <EditorPage roomId={roomId} theme={theme} setTheme={setTheme} profile={profile} setProfile={setProfile} />;
  }

  return <HomePage theme={theme} setTheme={setTheme} profile={profile} setProfile={setProfile} />;
}

export default App;
