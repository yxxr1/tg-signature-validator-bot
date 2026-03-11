import {MiddlewareFn, Context} from "telegraf";

export const validateEnvs = (): never | void => {
    let messages: string[] = [];

    if (!process.env.HOST) {
        messages.push('HOST env');
    }

    if (!process.env.WHITELIST_IDS) {
        messages.push('WHITELIST_IDS env');
    }

    if (!process.env.BOT_TOKEN) {
        messages.push('BOT_TOKEN env');
    }

    if (!process.env.SECRET_TOKEN) {
        messages.push('SECRET_TOKEN env');
    }

    if (!process.env.CA_CHAT_ID) {
        messages.push('CA_CHAT_ID (CA_TOPIC_ID) env');
    }

    if (!process.env.PUBLISH_DESTINATIONS) {
        messages.push('PUBLISH_DESTINATIONS (alias:chatId?:threadId) env');
    }

    if (!process.env.MONGO_URL) {
        messages.push('MONGO_URL env');
    }

    if (messages.length) {
        throw new Error(messages.join('\n'))
    }
}

const getAsyncQueueByKey = () => {
    const queue: Record<string, Promise<void>> = {};

    return (key: string, asyncFn: () => void) => {
        if (!queue[key]) {
            queue[key] = Promise.resolve();
        }

        const newPromise = queue[key].then(async () => {
            await asyncFn();

            if (queue[key] === newPromise) {
                delete queue[key];
            }
        });
        queue[key] = newPromise;
    }
}

export const queueMiddleware = <C extends Context = Context>(getKey: (ctx: C) => string): MiddlewareFn<C> => {
    const queue = getAsyncQueueByKey();

    return (ctx, next) => {
        const queueKey = getKey(ctx);

        queue(queueKey, next);
    }
}