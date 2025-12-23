// editor.js
// Sets up the CodeMirror editor and connects it to backend + sockets

function getParamsFromURL() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomId: params.get("roomId") || "demo-room",
    name: params.get("name") || "Guest",
  };
}

const { roomId, name } = getParamsFromURL();

// Show roomId and name in header
const roomIdSpan = document.getElementById("room-id-display");
if (roomIdSpan) {
  roomIdSpan.textContent = roomId;
}

const userNameSpan = document.getElementById("user-name-display");
if (userNameSpan) {
  userNameSpan.textContent = name;
}

// Initialize CodeMirror editor
const editor = CodeMirror(document.getElementById("editor"), {
  value: "",
  lineNumbers: true,
  mode: "javascript",
  theme: "dracula",
  tabSize: 2,
  indentUnit: 2,
  smartIndent: true,
});

// Load initial code from backend
fetch(`/api/rooms/${roomId}`)
  .then((res) => res.json())
  .then((data) => {
    editor.setValue(data.code || "");
  })
  .catch((err) => {
    console.error("Error loading room code:", err);
  });

// Initialize collaboration (defined in socket.js)
initCollab(roomId, name, editor);

// ---------- Console helpers ----------
const runBtn = document.getElementById("run-btn");
const outputDiv = document.getElementById("output");
const clearOutputBtn = document.getElementById("clear-output-btn");

// Utility: create an output line with optional timestamp
function appendOutputLine(text, withTimestamp = true) {
  if (!outputDiv) return;
  const line = document.createElement("div");
  line.className = "output-line";

  if (withTimestamp) {
    const ts = document.createElement("span");
    ts.className = "output-ts";
    const now = new Date();
    ts.textContent = now.toLocaleTimeString();
    line.appendChild(ts);
  }

  const txt = document.createElement("span");
  txt.textContent = text;
  line.appendChild(txt);

  outputDiv.appendChild(line);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

// Clear output handler
if (clearOutputBtn) {
  clearOutputBtn.addEventListener("click", () => {
    if (!outputDiv) return;
    outputDiv.innerHTML = "";
  });
}

// Run Code handler
if (runBtn) {
  runBtn.addEventListener("click", () => {
    if (!outputDiv) return;
    const code = editor.getValue();
    try {
      const realConsoleLog = console.log;
      console.log = (...args) => {
        appendOutputLine(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      };
      const result = eval(code);
      if (typeof result !== "undefined") {
        appendOutputLine(String(result));
      }
      console.log = realConsoleLog;
    } catch (err) {
      appendOutputLine("❌ Error: " + (err && err.message ? err.message : String(err)), true);
    }
  });
}

// Share link button
const shareBtn = document.getElementById("share-btn");
if (shareBtn && navigator.clipboard) {
  shareBtn.addEventListener("click", async () => {
    try {
      const base = window.location.origin;
      const shareUrl = `${base}/index.html?roomId=${encodeURIComponent(roomId)}`;
      await navigator.clipboard.writeText(shareUrl);
      const oldText = shareBtn.textContent;
      shareBtn.textContent = "Copied!";
      setTimeout(() => {
        shareBtn.textContent = oldText;
      }, 1500);
    } catch (err) {
      alert("Could not copy link. You can copy from the address bar.");
    }
  });
}

// ---------- Resizable panels (Editor <-> Side Panel) ----------
(function enableResizablePanels() {
  const divider = document.getElementById("drag-divider");
  const editorMain = document.getElementById("editor-main");
  const sidePanel = document.getElementById("side-panel");

  if (!divider || !editorMain || !sidePanel) return;

  let isDragging = false;
  let startX = 0;
  let startEditorWidth = 0;
  let startSideWidth = 0;
  
  const minEditor = 150; 
  const minSide = 100; 

  function setWidths(editorPx, sidePx) {
    const total = editorPx + sidePx + divider.offsetWidth;
    const maxSide = Math.floor(total * 0.8); 
    if (sidePx < minSide) sidePx = minSide;
    if (editorPx < minEditor) editorPx = minEditor;
    if (sidePx > maxSide) sidePx = maxSide;

    editorMain.style.flex = `0 0 ${editorPx}px`;
    sidePanel.style.flex = `0 0 ${sidePx}px`;
    try { editor.refresh(); } catch (e) {}
  }

  function onPointerDown(e) {
    isDragging = true;
    divider.classList.add("dragging");
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    const editorRect = editorMain.getBoundingClientRect();
    const sideRect = sidePanel.getBoundingClientRect();
    startEditorWidth = editorRect.width;
    startSideWidth = sideRect.width;
    document.body.style.userSelect = "none";
    document.body.style.cursor = window.getComputedStyle(divider).cursor || "col-resize";
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault && e.preventDefault();
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = clientX - startX;
    const newEditorW = Math.round(startEditorWidth + dx);
    const newSideW = Math.round(startSideWidth - dx);
    setWidths(newEditorW, newSideW);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove("dragging");
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("touchend", onPointerUp);
    try { editor.refresh(); } catch (e) {}
  }

  divider.addEventListener("dblclick", () => {
    const wrapper = divider.parentElement;
    const wrapperW = wrapper ? wrapper.clientWidth : window.innerWidth;
    const sideDefault = 260; 
    const editorDefault = Math.max(wrapperW - sideDefault - divider.offsetWidth, 300);
    setWidths(editorDefault, sideDefault);
  });

  divider.addEventListener("mousedown", onPointerDown);
  divider.addEventListener("touchstart", onPointerDown, { passive: true });

  window.addEventListener("load", () => {
    // Only set defaults if no flex is set.
    if (!sidePanel.style.flex) {
       // We use a safe default that respects small screens/zoom
       const wrapperW = document.querySelector('.editor-wrapper').clientWidth;
       const sideW = Math.min(260, Math.floor(wrapperW * 0.4));
       const editorW = wrapperW - sideW - divider.offsetWidth;
       setWidths(editorW, sideW);
    }
  });

})();

window.addEventListener("resize", () => {
  editor.refresh();
});