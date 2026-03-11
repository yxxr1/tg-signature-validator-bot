import mongoose from "mongoose";

export interface ChatMessageId {
  chatId: number;
  messageId: number;
}

export interface CertRecord {
  data: string;
  fileId: string;
  caChatMessageId: ChatMessageId;
  uploadTs: number;
  revokeTs?: number | null;
}

export interface User {
  userId: number;
  certs: CertRecord[];
}

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

export type ModelType<T extends object> = {
  [K in keyof T]: T[K] extends (infer O)[] ? (
      O extends object ? mongoose.Types.DocumentArray<ModelType<O>> : T[K]
  ) : (
      T[K] extends object ? ModelType<T[K]> : T[K]
  );
}
