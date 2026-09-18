import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "@/infrastructure/upload/uploadthing";

export const { GET, POST } = createRouteHandler({ router: uploadRouter });