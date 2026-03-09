import OpenAI from "openai";
import { OPENAI_VERSION, config, ensureSharedEnv } from "./config.js";

ensureSharedEnv();

const clientOptions = {
  apiKey: config.OPENAI_API_KEY
};

if (OPENAI_VERSION) {
  clientOptions.defaultQuery = { "api-version": OPENAI_VERSION };
}

export const openai = new OpenAI(clientOptions);
