import {NarrowedContext, Context} from "telegraf";
import {Update, InlineQueryResultCachedDocument} from "@telegraf/types";
import {userService} from "@/services/user";
import {formatUserString} from "../helpers";
import {INLINE_RESPONSE_LIMIT} from "./const";

class InlineQueryService {
    caChatId: number;

    constructor(caChatId: string) {
        this.caChatId = Number(caChatId);
    }

    async inlineQuery(ctx: NarrowedContext<Context, Update.InlineQueryUpdate>) {
        const certs = await userService.getAllCertsData(new Date());

        const result: (InlineQueryResultCachedDocument | null)[] = await Promise.all(certs.map(async (cert) => {
            const user =  await ctx.telegram.getChatMember(this.caChatId, cert.userId);

            return user.user.username?.startsWith(ctx.inlineQuery.query) ? {
                type: "document" as const,
                id: cert.userId.toString(),
                title: formatUserString(user.user),
                document_file_id: cert.fileId,
            } : null;
        }));

        await ctx.telegram.answerInlineQuery(
            ctx.inlineQuery.id,
            result.filter((el): el is InlineQueryResultCachedDocument => Boolean(el)).slice(0, INLINE_RESPONSE_LIMIT)
        );
    }

    async inlineQueryResult(ctx: NarrowedContext<Context, Update.ChosenInlineResultUpdate>) {
        const senderUser = ctx.chosenInlineResult.from;
        const certOwnerId = +ctx.chosenInlineResult.result_id;

        if (senderUser.id !== certOwnerId) {
            await ctx.telegram.sendMessage(certOwnerId, `${formatUserString(senderUser)} shared your cert`);
        }
    }
}

export const inlineQueryService = new InlineQueryService(process.env.CA_CHAT_ID);
