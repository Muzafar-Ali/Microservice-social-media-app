import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service.js";
import { 
  CreateUserDto, 
  createUserSchema, 
  GetUserByIdDto, 
  getUserByIdSchema, 
  GetUserByUsernameDto, 
  getUserByUsernameSchema, 
  UpdateMyProfileDto, 
  updateMyProfileSchema, 
  UpdateProfileImageDto, 
  updateProfileImageSchema,
} from "./user.schema.js";
import ApiErrorHandler from "../../utils/apiErrorHanlderClass.js";
import formatZodError from "../../utils/formatZodError.js";


export class UserController {

  constructor(private userService: UserService) {}

  createUser = async (req: Request<{}, {}, CreateUserDto>, res: Response, next: NextFunction) => {
    try {

      const parsedData = createUserSchema.safeParse(req.body);

      if (!parsedData.success) {
        throw new ApiErrorHandler(400, formatZodError(parsedData.error));
      }
      
      const user = await this.userService.createUser(parsedData.data)

      res.status(201).json({
        success: true,
        message: 'user created successfully',
        data: user
      })

    } catch (error) {
      next(error)
    }
  }
  
  getProfileById = async (req: Request<GetUserByIdDto>, res: Response, next: NextFunction) => {
    try {
      const parsedId = getUserByIdSchema.safeParse(req.params);

      if(!parsedId.success) {
        throw new ApiErrorHandler(400, formatZodError(parsedId.error));
      }
      
      const profile = await this.userService.getUserById(String(parsedId.data.id));

      if(!profile) {
        throw new ApiErrorHandler(404, "user not found");
      }

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  getProfileByUsername = async (req: Request<GetUserByUsernameDto>, res: Response, next: NextFunction) => {
    try {
      const parsedData = getUserByUsernameSchema.safeParse(req.params);

      if(!parsedData.success) {
        throw new ApiErrorHandler(400, formatZodError(parsedData.error));
      }

      const profile = await this.userService.getUserByUsername(parsedData.data.username);

      if(!profile) {
        throw new ApiErrorHandler(404, "user not found");
      }

      res.status(200).json({
        success: true,
        data: profile
      })

    } catch (error) {
      next(error)
    }
  }

  updateProfileImage = async (req: Request<{}, {}, UpdateProfileImageDto>, res: Response, next: NextFunction) => {
    try {
      const parsedData = updateProfileImageSchema.safeParse(req.body);
      const userId = req.userId;

      if(!parsedData.success) {
        throw new ApiErrorHandler(400, formatZodError(parsedData.error))
      }
     
      await this.userService.updateUserProfileImage(parsedData.data, String(userId));

      res.status(200).json({
        success: true,
        message: "Profile image updated successfully"
      })

    } catch (error) {
      next(error)
    }
  }

  updateMyProfile = async ( req: Request<{}, {}, UpdateMyProfileDto>, res: Response, next: NextFunction ) => {
    try {
      const userId = req.userId;

      if (!userId) {
        throw new ApiErrorHandler(401, "Unauthorized");
      }

      const parsedBody = updateMyProfileSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ApiErrorHandler(400, formatZodError(parsedBody.error));
      }

      const updatedProfile = await this.userService.updateMyProfile(
        String(userId),
        parsedBody.data
      );
      const {password, ...userWithoutPassword} =  updatedProfile;

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: userWithoutPassword,
      });
      
    } catch (error) {
      next(error);
    }
  };


}