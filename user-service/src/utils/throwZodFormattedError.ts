// utils/formatZodError.ts
import { ZodError } from "zod";

const formatZodError = (error: ZodError): string => {

  const message =  error.issues
    .map(issue => {
      const path = issue.path.join(".") || "root";
      return `${path}: ${issue.message}`;
    })
    .join(", ");

    return message
};

export default formatZodError;
