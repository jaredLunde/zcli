export { createContext } from "./create-context.ts";
import { cmd } from "./cmd.ts";
import { arg, args } from "./arg.ts";
import { help, helpOpt } from "./help.ts";
import { opt, opts } from "./opt.ts";

export * from "https://deno.land/x/zod@v3.20.2/mod.ts";

export { arg, args, cmd, help, helpOpt, opt, opts };
// const customErrorMap: zod.ZodErrorMap = (issue, ctx) => {
//   if (issue.code === zod.ZodIssueCode.invalid_type) {
//     if (issue.expected === "string") {
//       return { message: "bad type!" };
//     }
//   }
//   if (issue.code === zod.ZodIssueCode.custom) {
//     return { message: `less-than-${(issue.params || {}).minimum}` };
//   }
//   return { message: ctx.defaultError };
// };

// z.setErrorMap(customErrorMap);
