import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody
} from '@nestjs/websockets';
import { Task, TaskStatus } from '@prisma/client';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
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
   @SubscribeMessage('taskAdded')
    handleTaskAdd(@MessageBody() task: any) {
        console.log('Task added:', task); // Log for verification
        this.server.emit('taskAdded', task); // Broadcast task update to all connected clients
    }
   @SubscribeMessage('taskDeleted')
  handleTaskDeleted(@MessageBody() taskId: string) {
    console.log('Received task deletion request for taskId:', taskId);
    this.server.emit('taskDeleted', taskId); // You can also send the full task data if needed
  }
    // Événement pour la mise à jour de la tâche (à un utilisateur spécifique)
    @SubscribeMessage('taskUpdated')
    handleTaskUpdate(@MessageBody() taskData: any) {
        console.log('Task updated:', taskData); // Log for verification
        this.server.emit('taskUpdated', taskData); // Broadcast task update to all connected clients
    }
     @SubscribeMessage('bulkUpdateStatus')
handleBulkUpdateStatus(@MessageBody() payload: { count: number, taskIds: string[], status: TaskStatus }) {
  console.log('Received bulk update status:', payload);

  // Now we emit this to all connected clients so that they can reflect the updated tasks
  this.server.emit('bulkUpdateStatus', {
    count: payload.count,
    taskIds: payload.taskIds,  // Emit the taskIds
    status: payload.status,    // Emit the updated status
  });
}


    // Événement de test pour émettre un message personnalisé
    @SubscribeMessage('sendMessage')
    handleSendMessage(@MessageBody() message: string) {
        this.server.emit('messageReceived', message); // Émettre à tous les clients connectés
    }
}
