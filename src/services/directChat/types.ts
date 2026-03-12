import {Scenes} from "telegraf";
import type {Document} from "@telegraf/types";

interface VerifyData {
    content: string;
    sigFiles: Document[];
}
export type Context = Scenes.SceneContext<Scenes.SceneSessionData & { state?: { verifyData?: VerifyData } }>;
