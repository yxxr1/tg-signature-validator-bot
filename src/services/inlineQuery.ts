import {NarrowedContext, Context} from "telegraf";
import {Update} from "@telegraf/types";
import {userService} from "@/services/user";
import {formatUserString} from "@/services/helpers";
import {InlineQueryResultCachedDocument} from "@telegraf/types";

const INLINE_RESPONSE_LIMIT = 25;

class InlineQueryService {
    async inlineQuery(ctx: NarrowedContext<Context, Update.InlineQueryUpdate>) {
        const certs = await userService.getAllCertsData(new Date());

        const result: (InlineQueryResultCachedDocument | null)[] = await Promise.all(certs.map(async (cert) => {
            const user =  await ctx.telegram.getChatMember(process.env.CA_CHAT_ID, cert.userId);

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

export const inlineQueryService = new InlineQueryService();
