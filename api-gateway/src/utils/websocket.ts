import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { authService } from '../services/authService';

let io: SocketIOServer | null = null;

function ownerRoom(ownerId: number): string {
  return `owner:${ownerId}`;
}

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`WS client connected: ${socket.id}`);

    // 握手鉴权：客户端以 { auth: { token } } 连接；token 有效则加入该账号房间
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? authService.verifyToken(token) : null;
    if (payload) {
      socket.join(ownerRoom(payload.id));
      console.log(`WS client ${socket.id} joined owner room ${payload.id}`);
    } else {
      console.log(`WS client ${socket.id} unauthenticated (no join)`);
    }

    socket.on('disconnect', () => {
      console.log(`WS client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * 只给指定账号（owner）下所有在线设备推送 —— 同账号多设备实时同步的核心通道。
 */
export function broadcastToOwner(ownerId: number, event: string, data: unknown): void {
  if (io) {
    io.to(ownerRoom(ownerId)).emit(event, data);
  }
}
