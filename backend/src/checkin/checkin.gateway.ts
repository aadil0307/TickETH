import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/checkin',
})
export class CheckinGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CheckinGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Volunteer/scanner joins an event room */
  @SubscribeMessage('joinEvent')
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    client.join(`event:${data.eventId}`);
    this.logger.log(`Client ${client.id} joined room event:${data.eventId}`);
    return { event: 'joinedEvent', data: { eventId: data.eventId } };
  }

  /** Attendee joins their ticket room (to receive confirmation requests) */
  @SubscribeMessage('joinTicket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string },
  ) {
    client.join(`ticket:${data.ticketId}`);
    return { event: 'joinedTicket', data: { ticketId: data.ticketId } };
  }

  /** Emit to attendee: "Please confirm check-in" */
  emitConfirmationRequest(ticketId: string, checkinLogId: string) {
    this.server.to(`ticket:${ticketId}`).emit('confirmationRequest', {
      checkinLogId,
      ticketId,
      message: 'A volunteer scanned your ticket. Please confirm entry.',
    });
  }

  /** Emit to volunteer/event room: check-in result */
  emitCheckinResult(eventId: string, result: {
    checkinLogId: string;
    ticketId: string;
    status: string;
    message: string;
  }) {
    this.server.to(`event:${eventId}`).emit('checkinResult', result);
  }

  /** Broadcast live attendee count update */
  emitAttendeeCount(eventId: string, count: number) {
    this.server.to(`event:${eventId}`).emit('attendeeCount', { eventId, count });
  }
}
