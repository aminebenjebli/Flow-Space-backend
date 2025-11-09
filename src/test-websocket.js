// Importation du client WebSocket
const { io } = require("socket.io-client");

// Connexion à ton serveur WebSocket
const socket = io("ws://localhost:3000/tasks", {
  transports: ['websocket'],  // Utilisation de WebSocket comme transport
  query: { userId: "123" }    // Passe un paramètre userId à la connexion
});

// Lors de la connexion réussie au serveur
socket.on("connect", () => {
  console.log(`✅ Connecté au serveur WebSocket avec l'ID : ${socket.id}`);

  // Envoi d'une tâche mise à jour après la connexion
  const taskData = {
    userId: "123",  // L'ID de l'utilisateur
    id: "456",      // L'ID de la tâche
    title: "Test Task",
    status: "IN_PROGRESS"
  };

  // Envoi de l'événement "taskUpdated"
  socket.emit("taskUpdated", taskData);
  console.log("🚀 Message envoyé:", taskData);
});

// Écoute de l'événement "taskUpdated" émis par le serveur
socket.on("taskUpdated", (data) => {
  console.log("📩 Réponse du serveur :", data);
});

// Gestion de la déconnexion
socket.on("disconnect", () => {
  console.log("❌ Déconnecté du serveur WebSocket");
});
