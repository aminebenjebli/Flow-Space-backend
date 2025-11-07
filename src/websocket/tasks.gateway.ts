import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ transports: ['websocket'] })
export class TasksGateway {
  @WebSocketServer() server: Server;
  // Gateway initialization is handled by Nest; keep constructor lightweight

  // Gérer la connexion des utilisateurs
  handleConnection(client: Socket) {
    console.log('Client connecté:', client.id);
  }

  // Gérer la déconnexion des utilisateurs
  handleDisconnect(client: Socket) {
    console.log('Client déconnecté:', client.id);
  }

  // Événement pour la mise à jour de la tâche
  @SubscribeMessage('taskUpdated')
  handleTaskUpdate(@MessageBody() taskData: any) {
    console.log('Tâche mise à jour:', taskData);
    // Émettre l'événement à tous les clients connectés
    this.server.emit('taskUpdated', taskData);
  }

  // Événement de test pour émettre un message personnalisé
  @SubscribeMessage('sendMessage')
  handleSendMessage(@MessageBody() message: string) {
    this.server.emit('messageReceived', message);
  }
}
