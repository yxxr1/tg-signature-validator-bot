import * as openpgp from "openpgp"
import {Context, NarrowedContext} from "telegraf";
import {Message, Update} from "@telegraf/types";
import {CommandContextExtn} from "telegraf/src/telegram-types";
import {isSigFile, checkSig, getPublishDestinations, getFile} from "./helpers"
import {userService} from "./user"
import {messageSignatureService} from "./messageSignature"
import {ChatMessageId, SignatureRecord} from "./types"

const SUCCESS_EMOJI = '👍';
const FAILURE_EMOJI = '👎';
const FORBIDDEN_EMOJI = '😡';

class PublicChatService {
    publishDestinations: ReturnType<typeof getPublishDestinations>;

    constructor(publishDestinations: ReturnType<typeof getPublishDestinations>) {
        this.publishDestinations = publishDestinations;
    }

    async getActualSignaturesData(ctx: Context, signersChatId: number, contentMessageData: ChatMessageId, text: string): Promise<{ sigFileIds: string[]; needSigCount: number }> {
        let needSigCount = (await ctx.telegram.getChatMembersCount(signersChatId)) - 1;
        let sigEntities = await messageSignatureService.getMessageSignatures(contentMessageData);

        const verifiedSigEntities = (await Promise.all(sigEntities.map(async (sigEntity) => {
            const sigFile = await getFile(ctx, sigEntity.sigFileId);
            const signature = await openpgp.readSignature({ binarySignature: sigFile });
            const userCertData = (await userService.getUserCert(sigEntity.userId, new Date(sigEntity.sigDate)))?.data;
            if (!userCertData) return false;
            const userCert = await openpgp.readKey({ armoredKey: userCertData })
            const isSigValid = (await checkSig(text, signature, [userCert]))[0]

            return isSigValid ? sigEntity : false;
        }))).filter((el): el is SignatureRecord => Boolean(el));
        
        if (sigEntities.length !== verifiedSigEntities.length) {
            await messageSignatureService.setMessageSignatures(contentMessageData, verifiedSigEntities);
        }

        return { sigFileIds: verifiedSigEntities.map(({ sigFileId }) => sigFileId), needSigCount };
    }

    async signMessage(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.DocumentMessage & { reply_to_message: Message.TextMessage }>>) {
        const contentMessage = ctx.message.reply_to_message;
        const userId = ctx.message.from.id;
        const chatId = ctx.message.chat.id;
        const messageId = ctx.message.message_id;

        const contentMessageData: ChatMessageId = { chatId: contentMessage.chat.id, messageId: contentMessage.message_id };
        const document = ctx.message.document;

        if (!(await messageSignatureService.isUserSigned(contentMessageData, userId)) && isSigFile(document)) {
            const sigFile = await getFile(ctx, document.file_id);
            const signature = await openpgp.readSignature({ binarySignature: sigFile });

            const sigDate = signature.packets[0].created;
            const messageSigDate = new Date(ctx.message.date * 1000);

            const userCertData = (await userService.getUserCert(userId, messageSigDate))?.data;
            const isDateCorrect = !!sigDate && userCertData === (await userService.getUserCert(userId, sigDate))?.data;

            let isSigValid = false;

            if (userCertData && isDateCorrect) {
                const userCert = await openpgp.readKey({ armoredKey: userCertData });
                isSigValid = (await checkSig(contentMessage.text, signature, [userCert]))[0];
            }

            let reaction: typeof SUCCESS_EMOJI | typeof FAILURE_EMOJI;

            if (isSigValid) {
                await messageSignatureService.addMessageSignature(contentMessageData, userId, document.file_id, messageSigDate);
                reaction = SUCCESS_EMOJI;
            } else {
                reaction = FAILURE_EMOJI;
            }

            await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: reaction }]);
        } else {
            await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: FORBIDDEN_EMOJI }]);
        }
    }

    async chatMemberLeft(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.LeftChatMemberMessage>>) {
        await messageSignatureService.removeChatUserSignature(ctx.message.chat.id, ctx.message.left_chat_member.id);
    }

    async revokeSignMessage(ctx: NarrowedContext<Context, Update.MessageUpdate<Message & { reply_to_message: Message.TextMessage }>>) {
        const contentMessage = ctx.message.reply_to_message;
        const userId = ctx.message.from.id;
        const chatId = ctx.message.chat.id;
        const messageId = ctx.message.message_id;

        const contentMessageData: ChatMessageId = { chatId: contentMessage.chat.id, messageId: contentMessage.message_id };
        const userMessageSig = (await messageSignatureService.getMessageSignatures(contentMessageData)).find((sig) => sig.userId === userId);

        if (userMessageSig) {
            await messageSignatureService.removeMessageUserSignature(contentMessageData, userId);
            await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: SUCCESS_EMOJI }]);
        } else {
            await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: FORBIDDEN_EMOJI }]);
        }
    }

    async publishSignedMessage(ctx: NarrowedContext<Context, Update.MessageUpdate<Message & { reply_to_message: Message.TextMessage }>> & CommandContextExtn) {
        const contentMessage = ctx.message.reply_to_message;
        const chatId = ctx.message.chat.id;
        const messageId = ctx.message.message_id;

        const contentMessageData: ChatMessageId = { chatId: contentMessage.chat.id, messageId: contentMessage.message_id };

        const destinations = (ctx.args || []).filter((arg) => this.publishDestinations[arg]);
        const threadId = ctx.message.message_thread_id;

        if (destinations.length) {
            const { sigFileIds, needSigCount } = await this.getActualSignaturesData(ctx, chatId, contentMessageData, contentMessage.text);

            if (sigFileIds.length === needSigCount) {
                await Promise.all(destinations.map(async (alias) => {
                    const { chatId: destinationChatId, threadId: destinationThreadId } = this.publishDestinations[alias];
                    const publishedMessage = await ctx.telegram.sendMessage(destinationChatId, contentMessage.text, { message_thread_id: destinationThreadId, entities: contentMessage.entities });
                    await ctx.telegram.sendMediaGroup(destinationChatId, sigFileIds.map(fileId => ({ type: 'document', media: fileId })), { message_thread_id: destinationThreadId, reply_parameters: { message_id: publishedMessage.message_id } });
                }));
                await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: SUCCESS_EMOJI }]);
            } else {
                await ctx.telegram.sendMessage(chatId, `${sigFileIds.length}/${needSigCount} sigs`, { message_thread_id: threadId });
                await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: FORBIDDEN_EMOJI }]);
            }
        } else {
            await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: FORBIDDEN_EMOJI }]);
        }
    }

    async stateSignMessage(ctx: NarrowedContext<Context, Update.MessageUpdate<Message & { reply_to_message: Message.TextMessage }>>) {
        const contentMessage = ctx.message.reply_to_message;
        const chatId = ctx.message.chat.id;

        const contentMessageData: ChatMessageId = { chatId: contentMessage.chat.id, messageId: contentMessage.message_id };

        const threadId = ctx.message.message_thread_id;
        const sigData = await this.getActualSignaturesData(ctx, chatId, contentMessageData, contentMessage.text);

        await ctx.telegram.sendMessage(chatId, `${sigData.sigFileIds.length}/${sigData.needSigCount} sigs`, { message_thread_id: threadId });
    }

    async getSignData(ctx: NarrowedContext<Context, Update.MessageUpdate<Message & { reply_to_message: Message.TextMessage }>>) {
        const contentMessage = ctx.message.reply_to_message;
        const chatId = ctx.message.chat.id;

        const threadId = ctx.message.message_thread_id;
        const signData = contentMessage.text;
        const lineIndex = signData.indexOf('\n');
        const titleIndex = lineIndex === -1 ? signData.length : lineIndex;
        const filename = titleIndex > 0 && titleIndex < 50 ? signData.slice(0, titleIndex).trim().replaceAll(' ', '_') || 'signData' : 'signData';

        const replyParameters = { chat_id: contentMessage.chat.id, message_id: contentMessage.message_id };
        await ctx.telegram.sendDocument(chatId, { source: Buffer.from(signData), filename }, { message_thread_id: threadId, reply_parameters: replyParameters });
    }
}

export const publicChatService = new PublicChatService(getPublishDestinations(process.env.PUBLISH_DESTINATIONS || ''));
