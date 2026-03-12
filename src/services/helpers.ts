import * as openpgp from "openpgp"
import {Context} from "telegraf";
import {Document, User} from "telegraf/types"
import {buffer} from "node:stream/consumers";

export const checkSig = async (text: string, signature: openpgp.Signature, publicKeys: openpgp.PublicKey[]): Promise<[boolean, openpgp.KeyID | undefined] > => {
    try {
        const verificationResult = await openpgp.verify({
            message: await openpgp.createMessage({ text }),
            signature,
            verificationKeys: publicKeys
        });

        return [await verificationResult.signatures[0].verified, verificationResult.signatures[0].keyID]
    } catch {
        return [false, undefined];
    }
}

export const isCertFile = (document: Document) => document.mime_type === 'application/pgp-signature' && document.file_name?.endsWith('.asc');
export const isSigFile = (document: Document) => document.mime_type === 'application/pgp-signature' && document.file_name?.endsWith('.sig');

export const getPublishDestinations = (str: string) => {
    return str.split(',').reduce<Record<string, { chatId: number; threadId: number }>>((acc, item) => {
        const [alias, chatId, threadId] = item.split(':');

        acc[alias] = { chatId: Number(chatId), threadId: Number(threadId) };

        return acc;
    }, {})
}

export const getChatUrl = (chatId: number, threadId: number) => {
    const chatIdStr = chatId.toString();
    return `https://t.me/c/${chatIdStr.startsWith('-100') ? chatIdStr.slice(4) : ''}${threadId ? `/${threadId}` : ''}`;
};

export const getFile = async (ctx: Context, fileId: string) => {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const file = await fetch(fileLink);

    if (!file.body) {
        throw new Error('getFile failed');
    }

    return buffer(file.body);
}

export const hasValue = <T extends object, K extends keyof T>(obj: T, key: K): obj is T & Required<Pick<T, K>> => {
    return key in obj && obj[key] !== undefined;
}

export const formatUserString = (user: User) => `${user.first_name ? user.first_name + ' ' : ''}${user.last_name ? user.last_name + ' ' : ''}@${user.username}`