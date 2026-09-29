import { Resend } from "resend";

// ponytail: SO o client. Havia aqui um `sendOutbidEmail` que ninguem chamava
// (grep por `sendOutbidEmail`: zero imports, nem em teste) e que ja tinha
// divergido do caminho vivo: o `place-bid.ts` monta o e-mail inline, com a
// gravacao da notificacao e a leitura do seller em volta. Duas copias do mesmo
// `from` e do mesmo template, uma delas morta — e a morta e a que nao receberia
// um conserto de template. O `place-bid` mantem o envio inline porque a
// notificacao no banco e parte do mesmo "best effort" e vale a pena deixar o
// bloco inteiro legivel num so lugar; se um dia o envio for para virar
// repositorio, este e o arquivo.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}
