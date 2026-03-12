export interface SignatureRecord {
  userId: number;
  sigFileId: string;
  sigDate: number;
}

export interface MessageSignature {
  chatId: number;
  messageId: number;
  signatures: SignatureRecord[];
}
