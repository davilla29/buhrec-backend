import { Proposal } from "../models/Proposal.js";

function randomChunk(len = 6) {
  return Math.random().toString(36).slice(2).toUpperCase().slice(0, len);
}

export async function generateUniqueApplicationId(prefix = "BUH") {
  for (let i = 0; i < 10; i++) {
    const id = `${prefix}-${randomChunk(6)}`; // BUH-AF9SK2
    const exists = await Proposal.exists({ applicationId: id });
    if (!exists) return id;
  }
  throw new Error("Could not generate unique applicationId");
}
