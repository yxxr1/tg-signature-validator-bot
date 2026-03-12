import "dotenv/config";
import mongoose from "mongoose";
import {Telegraf, session, Composer, Context} from "telegraf";
import {Mongo as MongoSession} from "@telegraf/session/mongodb";
import {validateEnvs, queueMiddleware} from "@/helpers";
import {controller} from "@/controller";
import * as process from "node:process";

validateEnvs();

const start = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const privateKey = process.env.SSL_PRIVATE_KEY;
  const certificate = process.env.SSL_CERTIFICATE;
  const credentials = privateKey && certificate ? { key: privateKey, cert: certificate } : null;

  const port = Number(process.env.PORT) || (credentials ? 8443 : 88);
  const whitelistIds = (process.env.WHITELIST_IDS || '').split(',').map(Number);

  const bot = new Telegraf<Context>(process.env.BOT_TOKEN);
  bot.use((ctx, next) => {console.log(JSON.stringify(ctx.update)); next()});

  bot.use(queueMiddleware((ctx) => ctx.message?.chat.id + (ctx.message?.message_thread_id ? `:${ctx.message?.message_thread_id}` : '')));

  bot.use(session({ store: MongoSession<{}>({ client: mongoose.connection.getClient() }), defaultSession: () => ({}) }));

  bot.use(Composer.acl(whitelistIds, controller));

  const opts: Telegraf.LaunchOptions = process.env.DEV ? {} : {
    webhook: {
      domain: `${process.env.HOST}:${port}`,
      host: process.env.HOST,
      path: '/tg-signature-validator-bot-webhook',
      port,
      secretToken: process.env.SECRET_TOKEN,
      ...(credentials ? {
        tlsOptions: credentials,
        certificate: { source: Buffer.from(credentials.cert), filename: 'certificate' }
      } : {}),
    },
  };
  await bot.launch(opts, () => {
    console.log(process.env.DEV ? 'Server started with pooling [DEV]' : `Server started on port ${port} [HTTP${credentials ? 'S' : ''}]`);
  });
}

start();
