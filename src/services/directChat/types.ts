import {Scenes} from "telegraf";
import type {Document} from "@telegraf/types";

interface WaitVerifyDataStateData {
    content: string;
    sigFiles: Document[];
}
export type Context = Scenes.SceneContext<Scenes.SceneSessionData & { state?: { verifyData?: WaitVerifyDataStateData } }>;
