import {Scenes, Composer} from "telegraf";
import {message} from "telegraf/filters";
import {directChatService, USER_STATES, DirectChatContext} from "@/services";
import {DIRECT_CHAT_COMMANDS} from "@/controller/const";

const addStateCommands = (composer: Composer<DirectChatContext>) => {
    composer.command(DIRECT_CHAT_COMMANDS.BotUserState, (ctx) => directChatService.getUserState(ctx));
    composer.command(DIRECT_CHAT_COMMANDS.ClearBotUserState, (ctx) => directChatService.clearUserState(ctx));
}

const setPubkeyScene = new Scenes.BaseScene<DirectChatContext>(USER_STATES.WaitPubkey);
addStateCommands(setPubkeyScene);
setPubkeyScene.on(message('document'), (ctx) => directChatService.waitPubkeyState(ctx));
setPubkeyScene.use((ctx) => ctx.reply("pubkey expected"));

const verifyDataScene = new Scenes.BaseScene<DirectChatContext>(USER_STATES.WaitVerifyData);
addStateCommands(verifyDataScene);
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
composer.use((ctx) => ctx.reply('Unknown command'));

export const directChatController = composer;
