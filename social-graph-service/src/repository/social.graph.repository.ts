import { PrismaClient } from "../generated/prisma/client.js";

export class SocialGraphRepository {
  
  constructor(private prisma: PrismaClient) {}

  createFollow(){}
  deleteFollow(){}
  findFollowRelation(){}
  findFollowers(){}
  findFollowing(){}
  countFollowers(){}
  countFollowing(){}
  upsertUserProfileCache(){}
  findCachedUserById(){}
  findCachedUsersByIds(){}
}