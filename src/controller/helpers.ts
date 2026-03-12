import {Context, Middleware} from "telegraf";
import type {Message, Update, CallbackQuery} from "@telegraf/types";
import {DistinctKeys} from "telegraf/src/core/helpers/util";
import {KeyedDistinct} from "telegraf/typings/core/helpers/util";

const isDirectChat = (ctx: Context) => !!(
    ctx.from?.id && ctx.chat?.id && ctx.from?.id === ctx.chat?.id
);

const guard = <C extends Context>(guardFn: (ctx: C) => boolean, middleware: Middleware<C>): Middleware<C> => async (ctx, next) => {
    if (guardFn(ctx)) {
        typeof middleware === 'function' ? await middleware(ctx, next) : await (middleware.middleware()(ctx, next))
    } else {
        await next();
    }
}

export const directChatGuard = <C extends Context>(middleware: Middleware<C>) => guard<C>(isDirectChat, middleware);
export const publicChatGuard = <C extends Context>(middleware: Middleware<C>) => guard<C>((ctx) => !isDirectChat(ctx), middleware);

export const replyMessageFilter =
    <Ks extends DistinctKeys<Message>[]>(...keys: Ks) =>
        (
            update: Update
        ): update is Update.MessageUpdate<Message & { reply_to_message: KeyedDistinct<Message, Ks[number]> }> => {
            if (!('message' in update) || !('reply_to_message' in update.message) || update.message.reply_to_message === undefined) return false
            for (const key of keys) {
                if (!(key in update.message.reply_to_message)) return false
            }
            return true
        }

export const callbackQueryDataFilter = <T extends string>(value: T) => (update: Update): update is Update.CallbackQueryUpdate<CallbackQuery.DataQuery & { data: T}> => {
    return 'callback_query' in update && 'data' in update.callback_query && update.callback_query.data === value;
}