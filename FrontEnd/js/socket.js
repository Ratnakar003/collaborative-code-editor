// socket.js
// Handles all Socket.io communication for collaborative editing

function initCollab(roomId, name, editor) {
  console.log("Connecting to socket.io...");

  const socket = io(); // same origin (localhost/ngrok)
  let isRemoteUpdate = false;
  let isHost = false;

  // -- JOIN REQUEST ELEMENTS --
  const joinOverlay = document.getElementById("join-overlay");
  const joinOverlayText = document.getElementById("join-overlay-text");
  
  // -- HOST APPROVAL MODAL ELEMENTS --
  const approvalModal = document.getElementById("approval-modal");
  const approvalText = document.getElementById("approval-text");
  const btnApprove = document.getElementById("btn-approve");
  const btnReject = document.getElementById("btn-reject");

  // Store current pending request for host
  let currentRequest = null;

  function showJoinOverlay(text) {
    if (joinOverlay) joinOverlay.classList.remove("hidden");
    if (joinOverlayText && text) joinOverlayText.textContent = text;
    if (editor) editor.setOption("readOnly", true);
  }

  function hideJoinOverlay() {
    if (joinOverlay) joinOverlay.classList.add("hidden");
    if (editor) editor.setOption("readOnly", false);
  }

  const saveStatusEl = document.getElementById("save-status");
  const chatMessagesEl = document.getElementById("chat-messages");
  const chatInputEl = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");

  let saveTimeout;
  let typingTimeout;
  const typingEl = document.getElementById("typing-indicator");
  const userColorMap = {};
  const remoteCursors = {}; 

  // ------------------- TYPING ---------------------
  function emitTyping(typingName) {
    socket.emit("typing", { roomId, name: typingName });
  }

  function onEditorTyping() {
    emitTyping(name);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => emitTyping(""), 900);
  }

  function onChatTyping() {
    emitTyping(name);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => emitTyping(""), 900);
  }

  // ------------------- CONNECT & JOIN ---------------------
  socket.on("connect", () => {
    console.log("Connected:", socket.id);
    socket.emit("request-join", { roomId, name });
    showJoinOverlay("Waiting for host to approve...");
  });

  socket.on("join-approved", ({ roomId: joinedRoom, isHost: hostFlag }) => {
    hideJoinOverlay();
    isHost = hostFlag;
  });

  socket.on("join-rejected", ({ roomId: r }) => {
    showJoinOverlay("Host rejected your request.");
    alert("Your request to join room " + r + " was rejected.");
    window.location.href = "/index.html";
  });

  // --- HOST LOGIC: HANDLE INCOMING REQUESTS ---
  socket.on("join-request", ({ roomId: r, socketId, name: requesterName }) => {
    if (!isHost) return;
    
    // 1. Store the request details
    currentRequest = { roomId: r, socketId };
    
    // 2. Show the custom modal (instead of blocking window.confirm)
    if (approvalText) approvalText.textContent = `${requesterName} wants to join room ${r}.`;
    if (approvalModal) approvalModal.classList.remove("hidden");
  });

  // Wire up the modal buttons
  if (btnApprove) {
    btnApprove.onclick = () => {
      if (currentRequest) {
        socket.emit("approve-join", currentRequest);
        currentRequest = null;
      }
      if (approvalModal) approvalModal.classList.add("hidden");
    };
  }

  if (btnReject) {
    btnReject.onclick = () => {
      if (currentRequest) {
        socket.emit("reject-join", currentRequest);
        currentRequest = null;
      }
      if (approvalModal) approvalModal.classList.add("hidden");
    };
  }

  // ------------------- CODE SYNC ---------------------
  editor.on("change", () => {
    onEditorTyping();

    if (isRemoteUpdate) return;

    if (saveStatusEl) {
      saveStatusEl.textContent = "Saving...";
      saveStatusEl.classList.add("saving");
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const code = editor.getValue();
      socket.emit("code-change", { roomId, code });
      if (saveStatusEl) {
        saveStatusEl.textContent = "Saved";
        saveStatusEl.classList.remove("saving");
      }
    }, 500);
  });

  socket.on("code-update", (code) => {
    const current = editor.getValue();
    if (current === code) return;

    isRemoteUpdate = true;
    editor.setValue(code);
    isRemoteUpdate = false;
  });

  // ------------------- ONLINE USERS ---------------------
  socket.on("room-users", (users) => {
    users.forEach(u => {
      userColorMap[u.name] = u.color;
    });

    const listEl = document.getElementById("user-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    users.forEach((u) => {
      const li = document.createElement("li");
      li.className = "user-list-item";

      const sw = document.createElement("span");
      sw.className = "user-color-swatch";
      sw.style.background = u.color;

      const label = document.createElement("span");
      label.textContent = u.name === name ? `${u.name} (you)` : u.name;

      li.appendChild(sw);
      li.appendChild(label);
      listEl.appendChild(li);
    });
  });

  // ------------------- TYPING INDICATOR ---------------------
  socket.on("user-typing", ({ name: typingName }) => {
    if (!typingEl) return;

    if (!typingName) {
      typingEl.textContent = "";
      return;
    }

    const msg = `${typingName} is typing...`;
    typingEl.textContent = msg;

    setTimeout(() => {
      if (typingEl.textContent === msg) typingEl.textContent = "";
    }, 1100);
  });

  // ------------------- CHAT ---------------------
  function appendChatMessage(from, text, isMe) {
    const div = document.createElement("div");
    div.className = "chat-message" + (isMe ? " me" : "");

    const nameSpan = document.createElement("span");
    nameSpan.className = "chat-message-name";

    if (isMe) {
      nameSpan.textContent = "You";
      nameSpan.style.color = "#bbdcff";
    } else {
      nameSpan.textContent = from;
      if (userColorMap[from]) {
        nameSpan.style.color = userColorMap[from];
      }
    }

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    div.appendChild(nameSpan);
    div.appendChild(textSpan);

    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function sendChat() {
    const msg = chatInputEl.value.trim();
    if (!msg) return;
    socket.emit("chat-message", { roomId, name, message: msg });
    chatInputEl.value = "";
    emitTyping("");
  }

  if (chatSendBtn && chatInputEl) {
    chatSendBtn.addEventListener("click", sendChat);
    chatInputEl.addEventListener("input", onChatTyping);
    chatInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });
  }

  socket.on("chat-message", ({ name: from, message }) => {
    appendChatMessage(from, message, from === name);
  });

  // ------------------- CURSOR SYNC ---------------------
  editor.on("cursorActivity", () => {
    const cursor = editor.getCursor(); 
    socket.emit("cursor-move", { roomId, name, cursor });
  });

  socket.on("cursor-update", ({ name: userName, cursor }) => {
    if (userName === name) return; 

    const color = userColorMap[userName] || "#f87171";

    if (remoteCursors[userName]) {
      remoteCursors[userName].clear();
    }

    const cursorEl = document.createElement("div");
    cursorEl.style.position = "absolute";
    cursorEl.style.borderLeft = `2px solid ${color}`;
    cursorEl.style.height = `${editor.defaultTextHeight()}px`;
    cursorEl.style.zIndex = 999;

    const label = document.createElement("div");
    label.textContent = userName;
    label.style.position = "absolute";
    label.style.top = "-14px";
    label.style.left = "2px";
    label.style.padding = "1px 4px";
    label.style.fontSize = "10px";
    label.style.borderRadius = "4px";
    label.style.background = "rgba(0,0,0,0.7)";
    label.style.color = color;

    cursorEl.appendChild(label);

    const marker = editor.setBookmark(cursor, { widget: cursorEl });
    remoteCursors[userName] = marker;
  });
}