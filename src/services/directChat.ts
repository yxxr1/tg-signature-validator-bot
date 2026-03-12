import * as openpgp from "openpgp"
import {Format, NarrowedContext, Scenes, Markup} from "telegraf";
import {Update, Message, type Document} from "@telegraf/types";
import {CALLBACK_QUERY_DATA, DIRECT_CHAT_COMMANDS} from "@/controller/const"
import {checkSig, isCertFile, isSigFile, getPublishDestinations, getChatUrl, getFile, formatUserString} from "./helpers"
import {userService} from "./user"
import {USER_STATES} from "./const"
import {ChatMessageId} from "./types"

interface WaitVerifyDataStateData {
    content: string;
    sigFiles: Document[];
}
export type Context = Scenes.SceneContext<Scenes.SceneSessionData & { state?: { verifyData?: WaitVerifyDataStateData } }>;

const CERT_REVOKED_EMOJI = '🙈';

class DirectChatService {
    caChatId: number;
    caTopicId?: number;
    publishDestinations: string;
    startMessage?: string;

    constructor(caChatId: string, caTopicId?: string, publishDestinations?: string, startMessage?: string) {
        this.caChatId = Number(caChatId);
        this.caTopicId = caTopicId ? Number(caTopicId) : undefined;
        this.publishDestinations = publishDestinations || '';
        this.startMessage = startMessage;
    }

    async verifySignatures(ctx: Context): Promise<string[] | null> {
        const userState = ctx.session.__scenes?.state?.verifyData || { content: '', sigFiles: [] };

        if (userState?.content && userState?.sigFiles?.length) {
            const messages = await Promise.all(userState.sigFiles.map(async (file) => {
                const sigFile = await getFile(ctx, file.file_id);
                const signature = await openpgp.readSignature({ binarySignature: sigFile });
                const signatureCreated = signature.packets[0].created;
                const certsData = signatureCreated ? await userService.getAllCertsData(signatureCreated) : [];
                const pubkeys = await Promise.all(certsData.map(({ cert }) => openpgp.readKey({ armoredKey: cert })));

                const [isValid, keyId] = await checkSig(userState.content, signature, pubkeys);
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

    async start(ctx: Context) {
        if (this.startMessage) {
            await ctx.reply(this.startMessage);
        }
    }

    async setUserPubkey(ctx: NarrowedContext<Context, Update.MessageUpdate>) {
        const userCert = await userService.getUserCert(ctx.message.from.id, new Date());

        if (!userCert) {
            await ctx.scene.enter(USER_STATES.WaitPubkey);
            await ctx.reply('Pubkey ->');
        } else {
            await ctx.reply(`cert exists, use /${DIRECT_CHAT_COMMANDS.RevokeUserPubkey} to revoke`);
        }
    }

    async waitPubkeyState(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.DocumentMessage>>) {
        const userId = ctx.message.from.id;
        const userCert = await userService.getUserCert(userId, new Date());

        if (userCert) {
            await ctx.reply(`cert exists, use /${DIRECT_CHAT_COMMANDS.RevokeUserPubkey} to revoke`);
            await ctx.scene.leave();
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
                
                await ctx.reply("pubkey saved");
                await ctx.scene.leave();
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
        await ctx.scene.enter(USER_STATES.WaitVerifyData, { verifyData: { content: '', sigFiles: [] } });
        await ctx.reply('Content & Sigs ->', Markup.inlineKeyboard([[Markup.button.callback('Verify', CALLBACK_QUERY_DATA.VerifySignature)]]));
    }

    async verifySignatureContent(ctx: NarrowedContext<Context, Update.MessageUpdate<Message.TextMessage>>) {
        if (ctx.session.__scenes?.state?.verifyData) {
            ctx.session.__scenes.state.verifyData.content = ctx.message.text;
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
            await ctx.reply(messages.join('\n'));
            await ctx.scene.leave();
        } else {
            await ctx.reply('Content & Sigs ->');
        }
    }

    async publishAliases(ctx: Context) {
        const textArr = Object.entries(getPublishDestinations(this.publishDestinations))
            .map(([alias, { chatId, threadId }]) => Format.link(alias, getChatUrl(chatId, threadId)), []);
        await ctx.reply(Format.join(textArr, ' '));
    }

    async getUserState(ctx: Context) {
        await ctx.reply(ctx.session.__scenes?.current || USER_STATES.NoState);
    }

    async clearUserState(ctx: Context) {
        await ctx.scene.leave();
        await ctx.reply('OK');
    }
}

export const directChatService = new DirectChatService(process.env.CA_CHAT_ID, process.env.CA_TOPIC_ID, process.env.PUBLISH_DESTINATIONS, process.env.START_MESSAGE);
