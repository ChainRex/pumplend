import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface TokenConfig {
  name: string;
  symbol: string;
  description: string;
  logoUrl: string;
}

export async function generateAndCompileToken(config: TokenConfig) {
  // 生成Move代码
  const moveCode = generateMoveCode(config);
  console.log(moveCode);
  // 确保目录存在
  const tempDirPath = path.join(process.cwd(), '../contracts/token_factory/sources');
  await fs.mkdir(tempDirPath, { recursive: true });

  // 写入临时文件
  const tempFilePath = path.join(tempDirPath, `${config.symbol.toLowerCase()}.move`);
  await fs.writeFile(tempFilePath, moveCode);

  try {
    // 编译合约
    await new Promise((resolve, reject) => {
      exec('sui move build', {
        cwd: path.join(process.cwd(), '../contracts/token_factory')
      }, (error, stdout, _) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });

    // 读取编译后的字节码
    const bytecode = await fs.readFile(
      path.join(process.cwd(), `../contracts/token_factory/build/token_factory/bytecode_modules/${config.symbol.toLowerCase()}.mv`)
    );

    // 添加必要的依赖，使用正确的包ID
    const dependencies = [
      "0x0000000000000000000000000000000000000000000000000000000000000001", // std
      "0x0000000000000000000000000000000000000000000000000000000000000002"  // sui
    ];

    return {
      bytecode: Array.from(bytecode),
      dependencies
    };
  } finally {
    // 清理临时文件
    await fs.unlink(tempFilePath);
  }
}

function generateMoveCode(config: TokenConfig): string {
  return `
module token_factory::${config.symbol.toLowerCase()} {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url::{Self, Url};

    public struct ${config.symbol.toUpperCase()} has drop {}

    fun init(witness: ${config.symbol.toUpperCase()}, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<${config.symbol.toUpperCase()}>(
            witness,
            9,
            b"${config.symbol}",
            b"${config.name}",
            b"${config.description}",
            option::some<Url>(url::new_unsafe_from_bytes(b"${config.logoUrl}")),
            ctx
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx))
    }

    public entry fun mint(
        treasury_cap: &mut TreasuryCap<${config.symbol.toUpperCase()}>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx);
    }

    public fun burn(
        treasury_cap: &mut TreasuryCap<${config.symbol.toUpperCase()}>,
        coin: Coin<${config.symbol.toUpperCase()}>
    ) {
        coin::burn(treasury_cap, coin);
    }
}`;
} 