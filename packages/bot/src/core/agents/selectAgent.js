import { cleanText } from "../utils.js";

const OMNI_HINTS = [
  "leg uit",
  "explain",
  "analyseer",
  "analyze",
  "schrijf",
  "write",
  "maak",
  "build",
  "code",
  "refactor",
  "stappenplan",
  "step by step",
  "vergelijk",
  "compare",
  "hoe werkt",
  "how does",
  "debug"
];

function normalizeAgent(agent) {
  return cleanText(agent).toLowerCase();
}

export function selectAgent({ agent, message } = {}) {
  const normalizedAgent = normalizeAgent(agent);

  if (normalizedAgent === "valki" || normalizedAgent === "omni") {
    return normalizedAgent;
  }

  const text = cleanText(message).toLowerCase();
  if (!text) return "valki";

  if (OMNI_HINTS.some((hint) => text.includes(hint))) {
    return "omni";
  }

  return "valki";
}
