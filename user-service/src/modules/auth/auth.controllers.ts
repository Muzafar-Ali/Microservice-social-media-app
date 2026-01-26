import { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { UserLoginDto, userLoginSchema } from "./auth.schema.js";
import ApiErrorHandler from "../../utils/apiErrorHanlderClass.js";
import formatZodError from "../../utils/formatZodError.js";
import { generateJwtToken, generateJwtTokenAndSaveCookies } from "../../utils/JwtHelpers.js";
import { TLoginContext } from "./auth.types.js";
import { createWebSession, setWebSessionCookie } from "../../utils/sessionHelpers.js";

export class AuthController {

  constructor(private authService: AuthService) {}

  // loginHandler = async (req: Request<{}, {}, UserLoginDto>, res: Response, next: NextFunction) => {
  //   try {
  //     const safeData = userLoginSchema.safeParse(req.body)

  //     if(!safeData.success) {
  //       throw new ApiErrorHandler(400, formatZodError(safeData.error))
  //     }

  //     const dto: UserLoginDto = safeData.data;
  //     const identifier = (dto.email ?? dto.username)!; 

  //     const loginContext: TLoginContext = {
  //       identifier,
  //       ip: req.ip,
  //       userAgent: req.headers["user-agent"] ?? "",
  //     }

  //     const user = await this.authService.userLogin(dto, loginContext);
      
  //     const payload = {
  //       userId: user.id,
  //       email: user.email,
  //       username: user.username
  //     }

  //     generateJwtTokenAndSaveCookies(payload, res)
      
  //     res.status(200).json({
  //       success: true,
  //       message: "logged in successfully",
  //       data: {
  //         userId: user.id,
  //         username: user.username,
  //         email: user.email,
  //       }
  //     })

  //   } catch (error) {
  //     next(error)
  //   }
  // }

  webLoginHandler = async (req: Request<{}, {}, UserLoginDto>, res: Response, next: NextFunction) => {
    try {
      const safeData = userLoginSchema.safeParse(req.body)

      if(!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error))
      }

      const dto: UserLoginDto = safeData.data;
      const identifier = (dto.email ?? dto.username)!; 

      const loginContext: TLoginContext = {
        identifier,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? "",
      }

      const user = await this.authService.userLogin(dto, loginContext);
      
      const sessionId = await createWebSession({
        userId: user.id,
        ip: loginContext.ip,
        userAgent: loginContext.userAgent
      });

      setWebSessionCookie(res, sessionId);

      res.status(200).json({
        success: true,
        message: "logged in successfully",
        data: {
          userId: user.id,
          username: user.username,
          email: user.email,
        }
      })

    } catch (error) {
      next(error);
    }
  }

  mobileLoginHandler = async(req: Request, res: Response, next: NextFunction) => {
    try {
            const safeData = userLoginSchema.safeParse(req.body)

      if(!safeData.success) {
        throw new ApiErrorHandler(400, formatZodError(safeData.error))
      }

      const dto: UserLoginDto = safeData.data;
      const identifier = (dto.email ?? dto.username)!; 

      const loginContext: TLoginContext = {
        identifier,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? "",
      }

      const user = await this.authService.userLogin(dto, loginContext);
      
      const accessToken = generateJwtToken({
        userId: user.id,
        email: user.email,
        username: user.username
      });

      res.status(200).json({
        success: true,
        message: "logged in successfully",
        data: {
          accessToken,
          userId: user.id,
          username: user.username,
          email: user.email,
        },
      });

    } catch (error) {
      next(error)
    }
  }
}