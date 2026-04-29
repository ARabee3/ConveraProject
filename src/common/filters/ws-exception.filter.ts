import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const event = host.switchToWs().getPattern();

    let message = 'Internal server error';
    if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(`WebSocket error on event "${event}": ${message}`, exception instanceof Error ? exception.stack : undefined);

    client.emit('exception', {
      status: 'error',
      message,
      event,
    });
  }
}
