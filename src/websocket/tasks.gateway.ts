import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway(3000, {
    transports: ['websocket'],
    cors: { origin: '*' },
    namespace: '/tasks'
})
export class TasksGateway {
    @WebSocketServer() server: Server;
    private connectedUsers: Map<string, Set<string>> = new Map(); // Multiple connections per user

    // Gérer la connexion des utilisateurs
    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId) {
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, new Set());
            }
            this.connectedUsers.get(userId).add(client.id);
            client.join(userId);
            console.log(
                `Client connecté: ${client.id} pour l'utilisateur ${userId}`
            );
        }
    }

    // Gérer la déconnexion des utilisateurs
    handleDisconnect(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId) {
            this.connectedUsers.get(userId)?.delete(client.id);
            client.leave(userId);
            console.log(
                `Client déconnecté: ${client.id} pour l'utilisateur ${userId}`
            );
        }
    }

    // Événement pour la mise à jour de la tâche (à un utilisateur spécifique)
    @SubscribeMessage('taskUpdated')
    handleTaskUpdate(@MessageBody() taskData: any) {
        console.log('Task updated:', taskData); // Log for verification
        this.server.emit('taskUpdated', taskData); // Broadcast task update to all connected clients
    }

    // Événement de test pour émettre un message personnalisé
    @SubscribeMessage('sendMessage')
    handleSendMessage(@MessageBody() message: string) {
        this.server.emit('messageReceived', message); // Émettre à tous les clients connectés
    }
}
