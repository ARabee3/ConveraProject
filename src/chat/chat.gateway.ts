import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { ChatRateLimiterService } from './chat-rate-limiter.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@UseFilters(new WsExceptionFilter())
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly rateLimiter: ChatRateLimiterService,
  ) {}

  afterInit(server: Server): void {
    server.use((client: Socket, next: (err?: Error) => void) => {
      try {
        const token = this.extractToken(client);
        if (!token) {
          this.logger.warn(`Connection rejected: no token provided. Socket: ${client.id}`);
          return next(new Error('Unauthorized: no token provided'));
        }

        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
          this.logger.error('JWT_SECRET not configured');
          return next(new Error('Internal server error'));
        }
        const payload = jwt.verify(token, secret) as JwtPayload;

        client.data.userId = payload.sub;
        client.data.email = payload.email;
        client.data.role = payload.role;

        this.logger.log(`Client authenticated: ${client.id}, user: ${payload.sub}`);
        next();
      } catch (err) {
        this.logger.warn(`Connection rejected: invalid token. Socket: ${client.id}`);
        next(new Error('Unauthorized: invalid token'));
      }
    });
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}, user: ${client.data.userId}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}, user: ${client.data.userId}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    const { sessionId } = data;
    const userId = client.data.userId as string;

    if (!sessionId) {
      throw new WsException('sessionId is required');
    }

    const isMember = await this.chatService.validateSessionMembership(sessionId, userId);
    if (!isMember) {
      this.logger.warn(`Unauthorized subscription attempt by user ${userId} to session ${sessionId}`);
      throw new WsException('Unauthorized: You are not a member of this chat session');
    }

    this.logger.log(`User ${userId} joining room ${sessionId}`);
    client.join(sessionId);
    client.emit('subscribed', { sessionId });
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() dto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    const userId = client.data.userId as string;
    const { sessionId, content } = dto;

    const isMember = await this.chatService.validateSessionMembership(sessionId, userId);
    if (!isMember) {
      throw new WsException('Unauthorized: You are not a member of this chat session');
    }

    const rateLimit = await this.rateLimiter.checkLimit(userId);
    if (!rateLimit.allowed) {
      this.logger.warn(`Rate limit exceeded for user ${userId}`);
      client.emit('exception', {
        status: 'error',
        message: 'Rate limit exceeded. Please slow down.',
        event: 'send_message',
      });
      return { success: false };
    }

    this.logger.log(`User ${userId} sending message to session ${sessionId}`);

    const message = await this.chatService.sendMessage(sessionId, userId, content);

    if (!message) {
      this.logger.warn(`Policy violation detected for user ${userId} in session ${sessionId}`);
      client.emit('policy_violation', {
        sessionId,
        message: 'Your message contained contact information or external links and was rejected.',
      });
      return { success: false };
    }

    this.logger.log(`Message ${message.id} broadcasted to session ${sessionId}`);
    this.server.to(sessionId).emit('new_message', message);
    return { success: true };
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { sessionId: string; lastMessageId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    const { sessionId, lastMessageId } = data;
    const userId = client.data.userId as string;

    if (!sessionId || !lastMessageId) {
      throw new WsException('sessionId and lastMessageId are required');
    }

    await this.chatService.markAsRead(sessionId, lastMessageId, userId);

    this.server.to(sessionId).emit('read_receipt', {
      sessionId,
      lastReadMessageId: lastMessageId,
      readerId: userId,
    });
    return { success: true };
  }

  private extractToken(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const authObj = client.handshake.auth as { token?: string };
    if (authObj?.token) {
      return authObj.token;
    }

    return undefined;
  }
}
