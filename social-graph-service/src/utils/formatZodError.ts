import { ZodError } from "zod";

const formatZodError = (error: ZodError): string => {
  return  error.issues
    .map(issue => {
      const path = issue.path.join(".") || "root";
      return `${path}: ${issue.message}`;
    })
    .join(", ");
};

export default formatZodError;
