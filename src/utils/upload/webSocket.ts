import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

class WebSocket {
  private static io: Server;
  private static httpServer: HttpServer;
  public static processing = false;
  public static cancelProcessing = false;

  public static init(httpServer: HttpServer) {
    WebSocket.httpServer = httpServer;
  }

  public static getInstance() {
    if (!WebSocket.io) {
      console.log('Creating WebSocket instance...');
      WebSocket.io = new Server(WebSocket.httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
      });

      WebSocket.io.on('connection', (socket) => {
        console.log('Client connected', socket.id);

        socket.on('cancel', () => {
          WebSocket.cancelProcessing = true;
          socket.emit('cancelled', 'Processing cancelled by user');
        });

        socket.on('disconnect', () => {
          this.cancelProcessing = true;
        });
      });
    }

    return WebSocket.io;
  }

  public static getSocket(id: string) {
    const socket = WebSocket.io.sockets.sockets.get(id);
    return socket;
  }
}

export default WebSocket;
