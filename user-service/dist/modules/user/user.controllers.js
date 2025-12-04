import { createUserSchema, getUserByIdSchema, getUserByUsernameSchema } from "./user.schema.js";
import ApiErrorHandler from "../../utils/apiErrorHanlderClass.js";
import formatZodError from "../../utils/formatZodError.js";
export class UserController {
    userService;
    constructor(userService) {
        this.userService = userService;
    }
    createUser = async (req, res, next) => {
        try {
            const parsedData = createUserSchema.safeParse(req.body);
            if (!parsedData.success) {
                throw new ApiErrorHandler(400, formatZodError(parsedData.error));
            }
            const user = await this.userService.createUser(parsedData.data);
            res.status(201).json({
                success: true,
                message: 'user created successfully',
                data: user
            });
        }
        catch (error) {
            next(error);
        }
    };
    getProfileById = async (req, res, next) => {
        try {
            const parsedId = getUserByIdSchema.safeParse(req.params);
            if (!parsedId.success) {
                throw new ApiErrorHandler(400, formatZodError(parsedId.error));
            }
            const profile = await this.userService.getUserById(Number(parsedId.data.id));
            if (!profile) {
                throw new ApiErrorHandler(404, "user not found");
            }
            res.status(200).json({
                success: true,
                data: profile
            });
        }
        catch (error) {
            next(error);
        }
    };
    getProfileByUsername = async (req, res, next) => {
        try {
            const parsedData = getUserByUsernameSchema.safeParse(req.params);
            if (!parsedData.success) {
                throw new ApiErrorHandler(400, formatZodError(parsedData.error));
            }
            const profile = await this.userService.getUserByUsername(parsedData.data.username);
            if (!profile) {
                throw new ApiErrorHandler(404, "user not found");
            }
            res.status(200).json({
                success: true,
                data: profile
            });
        }
        catch (error) {
            next(error);
        }
    };
}
// const prisma = new PrismaClient();
// // NOTE: For learning only — in production, always hash passwords!
// export const createUser = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { email, name, password } = req.body;
//     if (!email || typeof email !== "string") {
//       return res.status(400).json({ error: "email (string) is required" });
//     }
//     if (!password || typeof password !== "string") {
//       return res.status(400).json({ error: "password (string) is required" });
//     }
//     const user = await prisma.user.create({
//       data: { email, name, password},
//       select: { id: true, email: true, name: true, createdAt: true, updatedAt: true }, // don't return password
//     });
//     res.status(201).json(user);
//   } catch (err: any) {
//     // unique violation: Prisma P2002
//     if (err?.code === "P2002") {
//       return res.status(409).json({ error: "Email already exists" });
//     }
//     next(err);
//   }
// };
// export const listUsers = async (_req: Request, res: Response, next: NextFunction) => {
//   try {
//     const users = await prisma.user.findMany({
//       select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
//       orderBy: { createdAt: "desc" },
//     });
//     res.json(users);
//   } catch (err) {
//     next(err);
//   }
// };
// export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const id = Number(req.params.id);
//     if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
//     const user = await prisma.user.findUnique({
//       where: { id },
//       select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
//     });
//     if (!user) return res.status(404).json({ error: "Not found" });
//     res.json(user);
//   } catch (err) {
//     next(err);
//   }
// };
