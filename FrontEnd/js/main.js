// Generate a simple random room id
function generateRandomRoomId() {
  const random = Math.random().toString(36).substring(2, 8);
  return "room-" + random;
}

const usernameInput = document.getElementById("username-input");
const roomIdInput = document.getElementById("roomid-input");
const joinBtn = document.getElementById("join-btn");
const randomBtn = document.getElementById("random-btn");
const urlParams = new URLSearchParams(window.location.search);
const sharedRoomId = urlParams.get("roomId");
if(sharedRoomId && roomIdInput){
  roomIdInput.value = sharedRoomId;
}

joinBtn.addEventListener("click", () => {
  const username = (usernameInput.value || "").trim();
  let roomId = (roomIdInput.value || "").trim();

  if (!username) {
    alert("Please enter your name");
    return;
  }

  if (!roomId) {
    roomId = generateRandomRoomId();
  }

  // Redirect to editor with roomId & name
  const url = `./editor.html?roomId=${encodeURIComponent(
    roomId
  )}&name=${encodeURIComponent(username)}`;
  window.location.href = url;
});

randomBtn.addEventListener("click", () => {
  const newRoomId = generateRandomRoomId();
  roomIdInput.value = newRoomId;
});
