import mongoose from "mongoose";

const messageSignatureSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
    index: true,
  },
  messageId: {
    type: Number,
    required: true,
    index: true,
  },
  signatures: [{
    userId: { type: Number, required: true },
    sigFileId: { type: String, required: true },
    sigDate: { type: Number, required: true }
  }]
});

export const messageSignatureModel = mongoose.model('MessageSignature', messageSignatureSchema);
