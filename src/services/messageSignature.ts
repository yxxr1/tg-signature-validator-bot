import mongoose from "mongoose"
import mongodb from "mongodb"
import {messageSignatureModel} from "@/model/messageSignature"
import {MessageSignature, SignatureRecord, ChatMessageId, ModelType} from "./types"

class MessageSignatureService {
    model: mongoose.Model<ModelType<MessageSignature>>;

    constructor(model: mongoose.Model<ModelType<MessageSignature>>) {
        this.model = model;
    }

    async isUserSigned({ chatId, messageId }: ChatMessageId, userId: number) {
      const existing = !!(await this.model.findOne({ chatId, messageId, signatures: { $elemMatch: { userId } } }, 'userId').exec());

      return existing;
    }
    async addMessageSignature({ chatId, messageId }: ChatMessageId, userId: number, sigFileId: string, sigDate: Date): Promise<mongodb.UpdateResult> {
      const newItem = { userId, sigFileId, sigDate: sigDate.valueOf() };
      return this.model.updateOne({ chatId, messageId }, { $push: { signatures: newItem } }, { upsert: true }).exec();
    }

    async removeMessageUserSignature({ chatId, messageId }: ChatMessageId, userId: number): Promise<mongodb.UpdateResult> {
      return this.model.updateOne({ chatId, messageId }, { $pull: { signatures: { userId } } }).exec();
    }
    async removeChatUserSignature(chatId: number, userId: number): Promise<mongodb.UpdateResult> {
      return this.model.updateOne({ chatId }, { $pull: { signatures: { userId } } }).exec();
    }

    async getMessageSignatures({ chatId, messageId }: ChatMessageId): Promise<SignatureRecord[]> {
      return (await this.model.findOne({ chatId, messageId }, 'signatures').exec())?.signatures || [];
    }
    async setMessageSignatures({ chatId, messageId }: ChatMessageId, signatures: SignatureRecord[]): Promise<mongodb.UpdateResult> {
      return this.model.updateOne({ chatId, messageId }, { signatures }, { upsert: true }).exec();
    }
}

export const messageSignatureService = new MessageSignatureService(messageSignatureModel);
