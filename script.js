// Client-side ChatFlow Application

const API_URL = "https://meapdev.github.io/api/functions";

// Friend requests system
let friendRequests = JSON.parse(localStorage.getItem('friendRequests')) || [];

// MongoDB Database Functions
const DATABASE = {
  users: [],

  async getAllUsers() {
    try {
      // Replace with your MongoDB API endpoint
      const response = await fetch(API_URL + "/users", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        this.users = await response.json();
        return this.users;
      }
      // Fallback to empty array if API fails
      return [];
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return [];
    }
  },

  async saveUser(user) {
    try {
      const response = await fetch(API_URL + "/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
      });
      if (response.ok) {
        return await response.json();
      }
      throw new Error("Failed to save user");
    } catch (error) {
      console.error("Failed to save user:", error);
      return null;
    }
  }
};

// UI Elements
const authScreen = document.getElementById("authScreen");
const chatScreen = document.getElementById("chatScreen");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const conversationsList = document.getElementById("conversationsList");

// Auth buttons
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const switchToRegister = document.getElementById("switchToRegister");
const switchToLogin = document.getElementById("switchToLogin");
const logoutBtn = document.getElementById("logoutBtn");

// Chat buttons
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");

// State
let currentUser = null;
let currentConversation = null;
let socket = null;
let messages = [];
let conversations = [];

// Initialize app
function init() {
  setupEventListeners();
  loadStoredData();
  if (currentUser) {
    showChatScreen();
    initSocket();
  }
}

// Event listeners
function setupEventListeners() {
  loginBtn?.addEventListener("click", handleLogin);
  registerBtn?.addEventListener("click", handleRegister);
  switchToRegister?.addEventListener("click", () => switchAuthForm("register"));
  switchToLogin?.addEventListener("click", () => switchAuthForm("login"));
  logoutBtn?.addEventListener("click", handleLogout);
  sendBtn?.addEventListener("click", sendMessage);
  newChatBtn?.addEventListener("click", startNewChat);
  messageInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  friendsList?.addEventListener("click", (e) => {
    const friendItem = e.target.closest(".friend-item");
    if (friendItem) {
      const friendName = friendItem.textContent;
      console.log("Friend selected:", friendName);
    }
  });

  // Tab buttons event listener
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tabName = btn.dataset.tab;
      const tabContents = document.querySelectorAll(".tab-content");
      const tabButtons = document.querySelectorAll(".tab-btn");

      // Remove active class from all tabs and buttons
      tabContents.forEach((tab) => tab.classList.remove("active"));
      tabButtons.forEach((b) => b.classList.remove("active"));

      // Add active class to clicked button and corresponding tab
      btn.classList.add("active");
      const activeTab = document.getElementById(tabName + "-tab");
      if (activeTab) {
        activeTab.classList.add("active");
      }
    });
  });

  // Search users input listener
  const searchUsersInput = document.getElementById("searchUsersInput");
  if (searchUsersInput) {
    searchUsersInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const searchResults = document.getElementById("searchResults");
      searchResults.innerHTML = "";

      if (searchTerm.length > 0) {

        const filteredUsers = DATABASE.users.filter((user) =>
          user.name.toLowerCase().includes(searchTer && user.id !== currentUser?.id));

        filteredUsers.forEach((user) => {
          const userDiv = document.createElement("div");
          userDiv.className = "user-search-result";
          userDiv.innerHTML = `<span>${user.name}</span><button class="add-friend-btn" data-user-id="${user.id}" data-user-name="${user.name}">Add Friend</button>`;
          searchResults.appendChild(userDiv);

          const addBtn = userDiv.querySelector(".add-friend-btn");
          addBtn.addEventListener("click", () =>
            addFriendToList(user.id, user.name)
          );
        });
      }
    });
  }
}

// Auth functions
function handleLogin() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!username || !password) {
    return;
  }
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find((u) => u.username === username);

  if (!user) {
    showError("loginError", "User not found");
    return;
  }

  if (user.password !== password) {
    showError("loginError", "Incorrect password");
    return;
  }

  currentUser = { id: user.id, username: user.username };
  saveUserSession();
  showChatScreen();
  initSocket();
}

function handleRegister() {
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const password2 = document.getElementById("regPassword2").value.trim();

  if (!username || !email || !password || !password2) {
    showError("registerError", "Please fill in all fields");
    return;
  }

  if (password !== password2) {
    showError("registerError", "Passwords do not match");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  if (users.some((u) => u.username === username)) {
    showError("registerError", "Username already exists");
    return;
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password
  };

  users.push(newUser);
  localStorage.setItem("users", JSON.stringify(users));

  currentUser = { id: newUser.id, username: newUser.username };
  saveUserSession();
  showChatScreen();
  initSocket();
}

function handleLogout() {
  currentUser = null;
  currentConversation = null;
  messages = [];
  localStorage.removeItem("userSession");
  clearAuthForm();
  showAuthScreen();
  if (socket) socket.disconnect();
}

function clearAuthForm() {
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("regUsername").value = "";
  document.getElementById("regEmail").value = "";
  document.getElementById("regPassword").value = "";
  document.getElementById("regPassword2").value = "";
  document.getElementById("loginError").textContent = "";
  document.getElementById("registerError").textContent = "";
}

function switchAuthForm(type) {
  const loginFormEl = document.getElementById("loginForm");
  const registerFormEl = document.getElementById("registerForm");

  if (type === "register") {
    loginFormEl.classList.remove("active");
    registerFormEl.classList.add("active");
  } else {
    registerFormEl.classList.remove("active");
    loginFormEl.classList.add("active");
  }
}

// UI Display functions
function showAuthScreen() {
  authScreen.classList.add("active");
  chatScreen.classList.remove("active");
}

function showChatScreen() {
  authScreen.classList.remove("active");
  chatScreen.classList.add("active");
  loadConversations();
}

function showError(elementId, message) {
  document.getElementById(elementId).textContent = message;
}

// Chat functions
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  const message = {
    id: Date.now().toString(),
    sender: currentUser.id,
    senderName: currentUser.username,
    text,
    timestamp: new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    conversationId: currentConversation?.id || "default"
  };

  messages.push(message);
  saveMessages();
  displayMessage(message);
  messageInput.value = "";

  // Emit via Socket.io if connected
  if (socket) {
    socket.emit("message:send", message);
  }
}

function displayMessage(message) {
  const isOwn = message.sender === currentUser.id;
  const div = document.createElement("div");
  div.className = `message ${isOwn ? "own" : "other"}`;
  div.innerHTML = `
    <div class="message-bubble">${escapeHtml(message.text)}</div>
    <div class="message-timestamp">${message.timestamp}</div>
  `;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function loadConversations() {
  conversationsList.innerHTML = "";

  if (conversations.length === 0) {
    conversationsList.innerHTML =
      '<div style="padding: 20px; color: #999; text-align: center;">No conversations</div>';
    return;
  }

  conversations.forEach((conv) => {
    const div = document.createElement("div");
    div.className = `conversation-item ${
      conv.id === currentConversation?.id ? "active" : ""
    }`;
    div.innerHTML = `
      <div class="conversation-item-name">${escapeHtml(conv.name)}</div>
      <div class="conversation-item-preview">${escapeHtml(
        conv.lastMessage || "No messages"
      )}</div>
    `;
    div.addEventListener("click", () => selectConversation(conv));
    conversationsList.appendChild(div);
  });
}

function selectConversation(conversation) {
  currentConversation = conversation;
  document.getElementById("chatTitle").textContent = conversation.name;
  loadConversations();
  messagesContainer.innerHTML = "";
  messages = JSON.parse(
    localStorage.getItem(`messages_${conversation.id}`) || "[]"
  );
  messages.forEach(displayMessage);
  messageInput.focus();
}

function startNewChat() {
  const name = prompt("Enter chat name:");
  if (!name) return;

  const newConv = {
    id: Date.now().toString(),
    name: name.trim(),
    createdBy: currentUser.id,
    members: [currentUser.id],
    createdAt: new Date(),
    lastMessage: ""
  };

  conversations.push(newConv);
  saveConversations();
  selectConversation(newConv);
}

// Socket.io initialization
function initSocket() {
  socket = io(API_URL, {
    auth: {
      userId: currentUser.id,
      username: currentUser.username
    }
  });

  socket.on("connect", () => {
    console.log("Connected to server");
    socket.emit("user:join", {
      userId: currentUser.id,
      username: currentUser.username
    });
  });

  socket.on("message:receive", (message) => {
    if (message.conversationId === currentConversation?.id) {
      displayMessage(message);
      saveMessages();
    }
  });

  socket.on("user:status", (data) => {
    console.log("User status:", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });
}

// Local storage functions
function saveUserSession() {
  localStorage.setItem("userSession", JSON.stringify(currentUser));
}

function loadStoredData() {
  const session = localStorage.getItem("userSession");
  if (session) {
    currentUser = JSON.parse(session);
  }

  const convData = localStorage.getItem(`conversations_${currentUser?.id}`);
  if (convData) {
    conversations = JSON.parse(convData);
  }
}

function saveConversations() {
  if (currentUser) {
    localStorage.setItem(
      `conversations_${currentUser.id}`,
      JSON.stringify(conversations)
    );
  }
}

function saveMessages() {
  if (currentConversation) {
    localStorage.setItem(
      `messages_${currentConversation.id}`,
      JSON.stringify(messages)
    );
  }
}

// Friend adding function
function addFriendToList(userId, userName) {
  const friendsList = document.getElementById("friendsList");
  const searchResults = document.getElementById("searchResults");

  // Check if friend is already added
  const existingFriends = Array.from(
    friendsList.querySelectorAll(".friend-item")
  ).map((el) => el.dataset.userId);
  if (existingFriends.includes(String(userId))) {
    alert(userName + " is already in your friends list!");
    return;
  }

  // Create friend item div
  const friendDiv = document.createElement("div");
  friendDiv.className = "friend-item";
  friendDiv.dataset.userId = userId;
  friendDiv.innerHTML = `<span>${userName}</span><button class="remove-friend-btn" onclick="removeFriend(${userId}, this)">Remove</button>`;

  friendsList.appendChild(friendDiv);
  searchResults.innerHTML = "";
  document.getElementById("searchUsersInput").value = "";
  alert(userName + " has been added to your friends!");

    // Send friend request to the user
    sendFriendRequest(currentUser.id, userId);
}

// Remove friend function
function removeFriend(userId, button) {
  const friendDiv = button.parentElement;
  friendDiv.remove();
  alert("Friend removed from your list!");
}

// Send friend request
function sendFriendRequest(fromUser, toUser) {
  const request = {
    id: Math.random(),
    from: fromUser,
    to: toUser,
    timestamp: new Date()
  };
  friendRequests.push(request);
  displayPendingRequests();
  alert(`Friend request sent to ${toUser}!`);
      // Save friend requests to localStorage
    localStorage.setItem('friendRequests', JSON.stringify(friendRequests));
}

// Display pending requests
function displayPendingRequests() {
  const requestsContainer =
    document.querySelector(".friend-requests") || document.createElement("div");
  requestsContainer.className = "friend-requests";
  requestsContainer.innerHTML = friendRequests.length
    ? friendRequests
        .map(
          (r) =>
            `<div><span>${r.from}</span><button onclick="acceptRequest('${r.from}')">Accept</button><button onclick="rejectRequest(${r.id})">Reject</button></div>`
        )
        .join("")
    : "<p>No pending requests</p>";
  const container =
    document.getElementById("friendRequests-content") ||
    document.querySelector(".tab-content");
  if (container && !container.querySelector(".friend-requests"))
    container.appendChild(requestsContainer);
}

// Accept friend request
function acceptRequest(userName) {
  const friendsList = document.getElementById("friendsList");
  const friendDiv = document.createElement("div");
  friendDiv.className = "friend-item";
  friendDiv.innerHTML = `<span>${userName}</span><button class="remove-friend-btn" onclick="removeFriend(null, this)">Remove</button>`;
  friendsList.appendChild(friendDiv);
  friendRequests = friendRequests.filter((r) => r.from !== userName);
  displayPendingRequests();
  alert(`You are now friends with ${userName}!`);
}

// Reject friend request
function rejectRequest(requestId) {
  friendRequests = friendRequests.filter((r) => r.id !== requestId);
  displayPendingRequests();
  alert("Friend request rejected!");
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", init);
