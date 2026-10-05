export type Scribble = { id: string; name: string; message: string; created_at: string };
export type WallPage = { messages: Scribble[]; next_cursor: string | null; total: number };
export type Language = "en" | "zh";
