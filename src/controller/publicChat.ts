import {Composer, Context} from "telegraf";
import {allOf, message} from "telegraf/filters";
import {CommandContextExtn} from "telegraf/src/telegram-types";
import {publicChatService} from "@/services";
import {PUBLIC_CHAT_COMMANDS} from "@/controller/const";
import {replyMessageFilter} from "@/controller/helpers";

type ContextWithCmd = Context & CommandContextExtn;

const composer = new Composer<Context>();

composer.use((ctx, next) => {
    if (ctx.message && 'caption' in ctx.message && 'caption_entities' in ctx.message && !('text' in ctx.message) && !('entities' in ctx.message)) {
        Object.assign(ctx.message, { text: ctx.message.caption, entities: ctx.message.caption_entities });
    }

    return next();
});

composer.on(message('left_chat_member'), (ctx) => publicChatService.chatMemberLeft(ctx));

const signComposer = new Composer<ContextWithCmd>();
signComposer.on(allOf(message('document'), replyMessageFilter('text')), (ctx) => publicChatService.signMessage(ctx));
composer.command(PUBLIC_CHAT_COMMANDS.SignMessage, signComposer)

const revokeComposer = new Composer<ContextWithCmd>();
revokeComposer.on(replyMessageFilter('text'), (ctx) => publicChatService.revokeSignMessage(ctx));
composer.command(PUBLIC_CHAT_COMMANDS.RevokeSignMessage, revokeComposer)

const publishComposer = new Composer<ContextWithCmd>();
publishComposer.on(replyMessageFilter('text'), (ctx) => publicChatService.publishSignedMessage(ctx));
composer.command(PUBLIC_CHAT_COMMANDS.PublishSignedMessage, publishComposer)

const stateComposer = new Composer<ContextWithCmd>();
stateComposer.on(replyMessageFilter('text'), (ctx) => publicChatService.stateSignMessage(ctx));
composer.command(PUBLIC_CHAT_COMMANDS.StateSignMessage, stateComposer)

const signDataComposer = new Composer<ContextWithCmd>();
signDataComposer.on(replyMessageFilter('text'), (ctx) => publicChatService.getSignData(ctx));
composer.command(PUBLIC_CHAT_COMMANDS.GetSignData, signDataComposer)

export const publicChatController = composer;
