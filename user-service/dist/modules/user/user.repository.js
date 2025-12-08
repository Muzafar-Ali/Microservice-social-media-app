export class UserRepository {
    prisma;
    constructor(prismaClient) {
        this.prisma = prismaClient;
    }
    createUser = async (data) => {
        return this.prisma.user.create({ data });
    };
    findByEmailOrUsername = async (email, username) => {
        return this.prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });
    };
    findById = async (id) => {
        return this.prisma.user.findUnique({ where: { id } });
    };
    findByUsername = async (username) => {
        return this.prisma.user.findUnique({ where: { username } });
    };
    updateUser = async (id, data) => {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    };
    updateProfileImage = async (secureUrl, publicId, userId) => {
        return this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                profileImage: {
                    secureUrl,
                    publicId,
                },
            },
        });
    };
}
