import {Scenes, Composer} from "telegraf";
import {message} from "telegraf/filters";
import {directChatService, DIRECT_CHAT_SCENES, DirectChatContext, DIRECT_CHAT_CALLBACK_QUERY_DATA} from "@/services";
import {DIRECT_CHAT_COMMANDS} from "./const";
import {callbackQueryDataFilter} from "./helpers";

const addStateCommands = (composer: Composer<DirectChatContext>) => {
    composer.command(DIRECT_CHAT_COMMANDS.CurrentScene, (ctx) => directChatService.getCurrentScene(ctx));
    composer.command(DIRECT_CHAT_COMMANDS.LeaveCurrentScene, (ctx) => directChatService.leaveCurrentScene(ctx));
}

const setPubkeyScene = new Scenes.BaseScene<DirectChatContext>(DIRECT_CHAT_SCENES.SetPubkey);
addStateCommands(setPubkeyScene);
setPubkeyScene.on(message('document'), (ctx) => directChatService.waitPubkeyDocument(ctx));
setPubkeyScene.use((ctx) => ctx.reply("pubkey expected"));

const verifyDataScene = new Scenes.BaseScene<DirectChatContext>(DIRECT_CHAT_SCENES.VerifySignature);
addStateCommands(verifyDataScene);
verifyDataScene.on(callbackQueryDataFilter(DIRECT_CHAT_CALLBACK_QUERY_DATA.VerifySignature), async (ctx) => {
    await directChatService.verifySignatureEnd(ctx);
    await ctx.telegram.answerCbQuery(ctx.callbackQuery.id);
});
verifyDataScene.command(DIRECT_CHAT_COMMANDS.VerifySignature, (ctx) => directChatService.verifySignatureEnd(ctx));
verifyDataScene.on(message('document'), (ctx) => directChatService.verifySignatureSig(ctx));
verifyDataScene.on(message('text'), (ctx) => directChatService.verifySignatureContent(ctx));
verifyDataScene.use((ctx) => ctx.reply('text content or sig expected'));

const composer = new Composer<DirectChatContext>();
const stage = new Scenes.Stage<DirectChatContext>([setPubkeyScene, verifyDataScene]);
composer.use(stage.middleware());

addStateCommands(composer);

composer.start((ctx) => directChatService.start(ctx));
composer.command(DIRECT_CHAT_COMMANDS.SetUserPubkey, (ctx) => directChatService.setUserPubkey(ctx));
composer.command(DIRECT_CHAT_COMMANDS.RevokeUserPubkey, (ctx) => directChatService.revokeUserPubkey(ctx));
composer.command(DIRECT_CHAT_COMMANDS.VerifySignature, (ctx) => directChatService.verifySignatureStart(ctx));
composer.command(DIRECT_CHAT_COMMANDS.PublishAliases, (ctx) => directChatService.publishAliases(ctx));

composer.on('message', (ctx) => ctx.reply('Unknown command'));

export const directChatController = composer;
