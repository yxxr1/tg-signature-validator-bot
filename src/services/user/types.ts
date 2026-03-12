import {ChatMessageId} from "../types";

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
