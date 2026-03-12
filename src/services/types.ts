import mongoose from "mongoose";

export type ModelType<T extends object> = {
  [K in keyof T]: T[K] extends (infer O)[] ? (
      O extends object ? mongoose.Types.DocumentArray<ModelType<O>> : T[K]
  ) : (
      T[K] extends object ? ModelType<T[K]> : T[K]
  );
}

export interface ChatMessageId {
  chatId: number;
  messageId: number;
}
