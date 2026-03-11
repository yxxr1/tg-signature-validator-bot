import mongoose from "mongoose"
import mongodb from "mongodb"
import {userModel} from "@/model/user"
import {User, CertRecord, ChatMessageId, ModelType} from "./types"

class UserService {
    model: mongoose.Model<ModelType<User>>;

    constructor(model: mongoose.Model<ModelType<User>>) {
        this.model = model;
    }

    isValidCert({ uploadTs, revokeTs }: CertRecord, validTs: number)  {
        return validTs > uploadTs && (!revokeTs || validTs < revokeTs);
    }

    async setUserCert(userId: number, data: string, fileId: string, uploadDate: Date, caChatMessageId: ChatMessageId): Promise<mongodb.UpdateResult> {
        const certData = { data, fileId, caChatMessageId: caChatMessageId, uploadTs: uploadDate.valueOf(), revokeTs: null };
        return this.model.updateOne({ userId }, { $push: { 'certs': certData } }, { upsert: true }).exec();
    }
    async revokeUserCert(userId: number, revokeDate: Date): Promise<mongodb.UpdateResult | void> {
        const certs = (await this.model.findOne({ userId }, 'certs').exec())?.certs || [];
        const currentDateTs = new Date().valueOf();
        const validCertIndex = certs.findIndex((cert) => this.isValidCert(cert, currentDateTs));

        if (validCertIndex != -1) {
            await this.model.updateOne({ userId }, { $set: { [`certs.${validCertIndex}.revokeTs`]: revokeDate.valueOf() } }).exec();
        }
    }

    async isCertUsed(certData: string): Promise<boolean> {
        return !!(await this.model.findOne({ 'certs.data': certData }, 'userId').exec());
    } 
    async getUserCert(userId: number, validOnDate: Date): Promise<CertRecord | undefined> {
        const validTs = validOnDate.valueOf();
        const certsData = (await this.model.findOne({ userId }, 'certs').exec())?.certs;
        return certsData?.find((cert) => this.isValidCert(cert, validTs));
    }
    async getAllCertsData(validOnDate: Date): Promise<{ userId: number; cert: string }[]> {
        const validTs = validOnDate.valueOf();
        return (await this.model.find({}, 'userId certs').exec()).map(({ userId, certs }) => {
            const data = certs?.find((cert) => this.isValidCert(cert, validTs))?.data;
            return data ? { userId, cert: data } : null;
        }).filter((el): el is { userId: number; cert: string } => Boolean(el));
    }
}

export const userService = new UserService(userModel);
