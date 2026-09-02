import { io, type Socket } from 'socket.io-client';
import { getApiUrl } from './cloud';

let socket: Socket | null = null;
let onChange: (() => void) | null = null;

/**
 * 连接实时同步通道（单例）。
 * 握手带 token 加入该账号房间；同账号其它设备有数据变更时服务端推送，
 * 收到后回调 onChange（调用方去增量拉取）。
 */
export function connectSyncSocket(token: string, onRemoteChange: () => void): Socket {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  onChange = onRemoteChange;
  socket = io(getApiUrl(), {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    auth: { token },
  });

  socket.on('sync-changed', () => onChange?.());
  socket.on('ledger-update', () => onChange?.());
  socket.on('connect', () => console.log('实时通道已连接'));
  socket.on('disconnect', () => console.log('实时通道已断开'));
  socket.on('connect_error', (err) => console.warn('实时通道连接失败:', err.message));

  return socket;
}

export function disconnectSyncSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    onChange = null;
  }
}
