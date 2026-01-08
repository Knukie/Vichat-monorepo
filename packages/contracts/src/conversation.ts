export type ConversationStatus = "open" | "pending" | "closed";

export type Conversation = {
  id: string;
  summary: string | null;
  status: ConversationStatus;
  assignedAgentId: string | null;
  departmentId: string | null;
  lastMessageAt: string | null;
};
