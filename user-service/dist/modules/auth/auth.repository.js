export class AuthRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getUserByEmailOrUsername = async (email, username) => {
        const orConditions = [];
        if (email) {
            orConditions.push({ email });
        }
        if (username) {
            orConditions.push({ username });
        }
        if (orConditions.length === 0) {
            return null; // no identifier given
        }
        const user = await this.prisma.user.findFirst({
            where: { OR: orConditions },
        });
        return user;
    };
}
