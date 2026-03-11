import {Composer, Context, MiddlewareFn} from "telegraf";
import {directChatController} from "./directChat";
import {publicChatController} from "./publicChat";
import {directChatGuard, publicChatGuard} from "./helpers"

const composer = new Composer<Context>();
composer.use(directChatGuard(directChatController) as MiddlewareFn<Context>);
composer.use(publicChatGuard(publicChatController));

export const controller = composer;
