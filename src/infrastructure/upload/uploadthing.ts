import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

const f = createUploadthing();

export const uploadRouter = {
  itemImages: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .input(z.object({ itemId: z.string().uuid() }))
    .onUploadComplete(async ({ file }) => {
      console.log("[UploadThing] upload completo:", file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;

export const utapi = new UTApi();