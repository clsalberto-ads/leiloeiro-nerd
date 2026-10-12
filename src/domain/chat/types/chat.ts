export type Role = "user" | "assistant";

/** Mensagem usada na interface (com id para o React). */
export interface Message {
  id: string;
  role: Role;
  content: string;
}

/** Formato enviado/recebido pela API. */
export interface ApiMessage {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  messages: ApiMessage[];
}

export interface ChatResponseBody {
  message: string;
}

export interface ChatErrorBody {
  error: string;
}
