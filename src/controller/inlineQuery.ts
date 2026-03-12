import {Composer, Context} from "telegraf";
import {inlineQueryService} from "@/services";

const composer = new Composer<Context>();

composer.on('inline_query', (ctx) => inlineQueryService.inlineQuery(ctx));
composer.on('chosen_inline_result', (ctx) => inlineQueryService.inlineQueryResult(ctx))

export const inlineQueryController = composer;
