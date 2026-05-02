export class ChatMessageSentEvent {
  constructor(
    public readonly sessionId: string,
    public readonly messageId: string,
    public readonly senderId: string,
    public readonly recipientId: string,
    public readonly content: string,
  ) {}
}
