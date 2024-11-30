import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DatabaseService {
  // 添加代币
  static async createToken(data: {
    name: string;
    symbol: string;
    type: string;
    icon: string;
    treasuryCapHolderId: string;
    poolId: string;
  }) {
    return prisma.token.create({
      data: {
        ...data,
        decimals: 9, // 使用默认值
      }
    });
  }


  // 获取所有代币
  static async getAllTokens() {
    return prisma.token.findMany();
  }
} 