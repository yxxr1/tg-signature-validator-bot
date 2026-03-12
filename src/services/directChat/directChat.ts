import * as openpgp from "openpgp"
import {Format, NarrowedContext, Markup} from "telegraf";
import {Update, Message} from "@telegraf/types";
import {DIRECT_CHAT_COMMANDS} from "@/controller/const"
import {userService} from "@/services/user"
import {
    checkSig,
    isCertFile,
    isSigFile,
    getPublishDestinations,
    getChatUrl,
    getFile,
    formatUserString,
    getSignData
} from "../helpers"
import {ChatMessageId} from "../types";
import {SCENES, CALLBACK_QUERY_DATA} from "./const"
import {Context} from "./types";

const CERT_REVOKED_EMOJI = '🙈';

class DirectChatService {
    caChatId: number;
    caTopicId?: number;
    publishDestinations: ReturnType<typeof getPublishDestinations>;
    startMessage?: string;

    constructor(publishDestinations: string, caChatId: string, caTopicId?: string, startMessage?: string) {
        this.caChatId = Number(caChatId);
        this.caTopicId = caTopicId ? Number(caTopicId) : undefined;
        this.publishDestinations = getPublishDestinations(publishDestinations);
        this.startMessage = startMessage;
    }

    private async verifySignatures(ctx: Context): Promise<string[] | null> {
        const state = ctx.session.__scenes?.state?.verifyData || { content: '', sigFiles: [] };

        if (state?.content && state?.sigFiles?.length) {
            const messages = await Promise.all(state.sigFiles.map(async (file) => {
                const sigFile = await getFile(ctx, file.file_id);
                const signature = await openpgp.readSignature({ binarySignature: sigFile });
                const signatureCreated = signature.packets[0].created;
                const certsData = signatureCreated ? await userService.getAllCertsData(signatureCreated) : [];
                const pubkeys = await Promise.all(certsData.map(({ cert }) => openpgp.readKey({ armoredKey: cert })));

                const [isValid, keyId] = await checkSig(state.content, signature, pubkeys);
                const pubkeyIndex = keyId ? pubkeys.findIndex((pubkey) => pubkey.getKeyID().equals(keyId)) : -1;
                const userId: number | undefined = certsData[pubkeyIndex]?.userId;
                let userString = 'Unknown';

                if (userId) {
                    const userInfo = (await ctx.telegram.getChatMember(this.caChatId, userId)).user;
                    userString = formatUserString(userInfo);
                }

                return `[${userString}] ${file.file_name}: ${isValid ? 'OK' : 'NOT OK'}`;
            }));

            return messages;
        }

        return null;
    }

    private async enterScene(ctx: Context, name: typeof SCENES[keyof typeof SCENES], text: string, initialState?: object) {
        await ctx.scene.enter(name, initialState);
        await ctx.reply(text, Markup.keyboard([[Markup.button.text(`/${DIRECT_CHAT_COMMANDS.LeaveCurrentScene}`)]]));
    }
    private async leaveScene(ctx: Context, text: string) {
        await ctx.scene.leave();
        await ctx.reply(text, Markup.removeKeyboard());
    }

    async start(ctx: Context) {
        if (this.startMessage) {
            await ctx.reply(this.startMessage);
        }
    }

    async setUserPubkey(ctx: NarrowedContext<Context, Update.MessageUpdate>) {
        const userCert = await userService.getUserCert(ctx.message.from.id, new Date());

        if (!userCert) {
            await this.enterScene(ctx, SCENES.SetPubkey, 'Pubkey ->')
        } else {
            await ctx.reply(`cert exists, use /${DIRECT_CHAT_COMMANDS.RevokeUserPubkey} to revoke`);
        }
    }

    async waitPubkeyDocument(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.DocumentMessage>>) {
        const userId = ctx.message.from.id;
        const userCert = await userService.getUserCert(userId, new Date());

        if (userCert) {
            await this.leaveScene(ctx, `cert exists, use /${DIRECT_CHAT_COMMANDS.RevokeUserPubkey} to revoke`);
            return;
        }

        const document = ctx.message.document;

        if (isCertFile(document)) {
            const file = await getFile(ctx, document.file_id);
            const certStr = file.toString();

            if (!(await userService.isCertUsed(certStr))) {
                const res = await ctx.telegram.sendDocument(this.caChatId, document.file_id, { message_thread_id: this.caTopicId, caption: `@${ctx.message.from.username}` });
                const caChatMessageId: ChatMessageId = { chatId: this.caChatId, messageId: res.message_id };
                await userService.setUserCert(userId, certStr, document.file_id, new Date(), caChatMessageId);

                await this.leaveScene(ctx, "pubkey saved");
            } else {
                await ctx.reply("cert was used");
            }
        } else {
            await ctx.reply("pubkey expected");
        }
    }

    async revokeUserPubkey(ctx: NarrowedContext<Context, Update.MessageUpdate>) {
        const userId = ctx.message.from.id;
        const currentDate = new Date();
        const userCert = await userService.getUserCert(userId, currentDate);
        
        if (userCert) {
            await userService.revokeUserCert(userId, currentDate);
            const { chatId, messageId } = userCert.caChatMessageId;
            await ctx.telegram.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: CERT_REVOKED_EMOJI }], true);
            await ctx.reply('Pubkey revoked');
        } else {
            await ctx.reply(`no cert, use /${DIRECT_CHAT_COMMANDS.SetUserPubkey} to set`);
        }
    }

    async verifySignatureStart(ctx: Context) {
        await this.enterScene(ctx, SCENES.VerifySignature, 'Content & Sigs ->', { verifyData: { content: '', sigFiles: [] } });
        await ctx.reply('Verify', Markup.inlineKeyboard([[Markup.button.callback('✅', CALLBACK_QUERY_DATA.VerifySignature)]]));
    }

    async verifySignatureContent(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.TextMessage>>) {
        if (ctx.session.__scenes?.state?.verifyData) {
            ctx.session.__scenes.state.verifyData.content = getSignData(ctx.message);
        }
    }
    async verifySignatureSig(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.DocumentMessage>>) {
        if (isSigFile(ctx.message.document)) {
            if (ctx.session.__scenes?.state?.verifyData) {
                ctx.session.__scenes?.state.verifyData.sigFiles.push(ctx.message.document);
            }
        } else {
            await ctx.reply('sig file expected');
        }
    }

    async verifySignatureEnd(ctx: Context) {
        const messages = await this.verifySignatures(ctx);

        if (messages) {
            await this.leaveScene(ctx, messages.join('\n'));
        } else {
            await ctx.reply('Content & Sigs ->');
        }
    }

    async publishAliases(ctx: Context) {
        const textArr = Object.entries(this.publishDestinations)
            .map(([alias, { chatId, threadId }]) => Format.link(alias, getChatUrl(chatId, threadId)), []);
        await ctx.reply(Format.join(textArr, ' '));
    }

    async getCurrentScene(ctx: Context) {
        await ctx.reply(ctx.session.__scenes?.current || 'No Scene');
    }

    async leaveCurrentScene(ctx: Context) {
        await this.leaveScene(ctx, "OK")
    }
}

export const directChatService = new DirectChatService(process.env.PUBLISH_DESTINATIONS, process.env.CA_CHAT_ID, process.env.CA_TOPIC_ID, process.env.START_MESSAGE);
