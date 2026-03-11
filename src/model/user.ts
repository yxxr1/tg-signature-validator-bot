import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: {
    type: Number,
    unique: true,
    index: true,
    required: true,
  },
  certs: [{
    data: { type: String, required: true },
    fileId:  { type: String, required: true },
    caChatMessageId: {
      type: {
        chatId: { type: Number, required: true },
        messageId: { type: Number, required: true }
      },
      required: true,
    },
    uploadTs:  { type: Number, required: true },
    revokeTs: { type: Number, required: false },
  }],
});

export const userModel = mongoose.model('User', userSchema);
