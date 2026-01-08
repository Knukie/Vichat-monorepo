import OpenAI from "openai";
import { config, ensureSharedEnv } from "./config.js";

ensureSharedEnv();

export const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
