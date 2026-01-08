export type UserRole = "customer" | "assistant" | "agent" | "admin";

export type UserStatus = "online" | "offline" | "away";

export type User = {
  id: string;
  role: UserRole;
  displayName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
};
