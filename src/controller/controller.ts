import {Composer, Context, MiddlewareFn} from "telegraf";
import {directChatGuard, publicChatGuard} from "./helpers"
import {directChatController} from "./directChat";
import {publicChatController} from "./publicChat";
import {inlineQueryController} from "./inlineQuery";

const composer = new Composer<Context>();
composer.use(directChatGuard(directChatController) as MiddlewareFn<Context>);
composer.use(publicChatGuard(publicChatController));
composer.use(inlineQueryController);

export const controller = composer;
