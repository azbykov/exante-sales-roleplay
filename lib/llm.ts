import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel, ModelMessage } from "ai";
import type { Turn } from "./state";

/**
 * The model is configuration, not a hard-wired dependency.
 *
 * With OPENAI_API_KEY present we go to OpenAI directly; otherwise a
 * "creator/model" string is routed through the Vercel AI Gateway (on Vercel it
 * authorises with the deployment's OIDC token, so no project secret is needed).
 *
 * The avatar needs speed and the evaluator needs depth, so each has its own model.
 */
const IDS = {
  avatar: process.env.AVATAR_MODEL ?? "openai/gpt-5.2",
  evaluator: process.env.EVALUATOR_MODEL ?? "openai/gpt-5.2",
};

const openai = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export function model(role: keyof typeof IDS): LanguageModel {
  const id = IDS[role];
  return openai ? openai(id.replace(/^openai\//, "")) : id;
}

/** The conversation as the model sees it. */
export function toMessages(turns: Turn[]): ModelMessage[] {
  return turns.map((t) => ({ role: t.role, content: t.content }));
}
