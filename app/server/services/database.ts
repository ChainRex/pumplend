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
    collateralId: string;
    metadataId: string;
    totalSupply: BigInt;
    collectedSui: BigInt;
    status: string;
  }) {
    return prisma.token.create({
      data: {
        ...data,
        decimals: 9,
        totalSupply: BigInt(data.totalSupply.toString()),
        collectedSui: BigInt(data.collectedSui.toString()),
      }
    });
  }

  // 获取所有代币
  static async getAllTokens() {
    const tokens = await prisma.token.findMany();
    return tokens.map(token => ({
      ...token,
      totalSupply: token.totalSupply.toString(),
      collectedSui: token.collectedSui.toString(),
    }));
  }

  static async updateTokenStatus(
    type: string,
    totalSupply: bigint,
    collectedSui: bigint,
    status: string
  ) {
    return prisma.token.update({
      where: { type },
      data: {
        totalSupply,
        collectedSui,
        status,
      }
    });
  }

  // 获取单个代币状态
  static async getTokenStatus(type: string) {
    return prisma.token.findUnique({ where: { type } });
  }

  static async updateTokenPool(
    type: string,
    {
      poolId,
      positionId,
      tickLower,
      tickUpper,
      liquidity
    }: {
      poolId: string;
      positionId: string;
      tickLower: number;
      tickUpper: number;
      liquidity: string;
    }
  ) {
    return prisma.token.update({
      where: { type },
      data: {
        poolId,
        positionId,
        tickLower,
        tickUpper,
        liquidity
      }
    });
  }

  static async getTokenPool(type: string) {
    return prisma.token.findUnique({
      where: { type },
      select: {
        poolId: true,
        positionId: true,
        tickLower: true,
        tickUpper: true,
        liquidity: true
      }
    });
  }

  // 创建借贷池记录
  static async createLending(data: {
    name: string;
    symbol: string;
    type: string;
    icon: string;
    metadataId: string;
    lendingPoolId: string;
    ltv: number;
    liquidation_threshold: number;
  }) {
    return prisma.lending.create({
      data: {
        ...data,
        decimals: 9,
      }
    });
  }

  // 检查借贷池是否存在
  static async getLending(tokenType: string) {
    return prisma.lending.findUnique({
      where: { type: tokenType }
    });
  }

  // 获取所有借贷池
  static async getAllLendings() {
    return prisma.lending.findMany();
  }
} 