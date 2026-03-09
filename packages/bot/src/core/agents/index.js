import { OMNI_PERSONA } from "./omniPersona.js";
import { VALKI_PERSONA } from "./valkiPersona.js";

const PERSONAS = {
  valki: VALKI_PERSONA,
  omni: OMNI_PERSONA
};

export function getAgentPersona(agentName = "valki") {
  const key = typeof agentName === "string" ? agentName.toLowerCase() : "valki";
  return PERSONAS[key] || PERSONAS.valki;
}
