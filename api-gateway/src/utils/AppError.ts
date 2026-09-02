/**
 * 可预期的业务错误（如资源不存在、参数非法）。
 * 这类错误会向客户端返回具体 message，不暴露堆栈。
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}