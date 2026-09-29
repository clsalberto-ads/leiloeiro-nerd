import { UTApi } from "uploadthing/server";

// ponytail: SO o `UTApi` (SDK de servidor, chamado por `uploadItemImagesAction` com
// os arquivos ja validados) — nao ha `uploadRouter` aqui, e a ausencia e uma
// decisao, nao uma pendencia. O `uploadRouter` + a rota `POST /api/uploadthing`
// que o montava eram um endpoint de upload de navegador SEM `.middleware()`, ou
// seja, aceito por qualquer um sem cookie: 10 arquivos de 8MB por request, sem
// conta, sem rate limit e sem vinculo com um item, queimando a cota paga do
// projeto. Nada no app consumia esse caminho — o grep por `UploadDropzone` /
// `uploadthing/react` / `/api/uploadthing` nao retornava nada, e o upload
// real ja passa pelo `utapi.uploadFiles()` depois de `imageUploadSchema` e do
// `getSession()` da action. Reintroduzir upload pelo cliente? Traga o
// `uploadRouter` JUNTO com o `.middleware()` que exige sessao e com o
// consumidor no mesmo commit.
export const utapi = new UTApi();
