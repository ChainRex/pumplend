import express from 'express';
import cors from 'cors';
import { generateAndCompileToken } from './api/tokenCompiler';
import { DatabaseService } from './services/database';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/compile-token', async (req, res) => {
  try {
    const { name, symbol, description, logoUrl } = req.body;
    
    const result = await generateAndCompileToken({
      name,
      symbol,
      description,
      logoUrl
    });

    res.json(result);
  } catch (error) {
    console.error('编译代币时出错:', error);
    res.status(500).json({ error: '代币编译失败' });
  }
});

// 创建代币
app.post('/api/tokens', async (req, res) => {
  try {
    const token = await DatabaseService.createToken(req.body);
    const tokenResponse = {
      ...token,
      totalSupply: token.totalSupply.toString(),
      collectedSui: token.collectedSui.toString(),
    };
    res.json(tokenResponse);
  } catch (error) {
    console.error('创建代币失败:', error);
    res.status(500).json({ error: '创建代币失败' });
  }
});

// 获取所有代币列表
app.get('/api/tokens', async (req, res) => {
  try {
    const tokens = await DatabaseService.getAllTokens();
    console.log("获取代币列表成功:", tokens);
    res.json(tokens);
  } catch (error) {
    console.error('获取代币列表失败:', error);
    res.status(500).json({ error: '获取代币列表失败' });
  }
});

// 更新代币状态
app.post('/api/tokens/:type/status', async (req, res) => {
  try {
    
    const { type } = req.params;
    const { totalSupply, collectedSui, status } = req.body;
    console.log("更新代币状态:", totalSupply, collectedSui, status);
    
    const token = await DatabaseService.updateTokenStatus(
      type,
      BigInt(totalSupply),
      BigInt(collectedSui),
      status
    );

    const tokenResponse = {
      ...token,
      totalSupply: token.totalSupply.toString(),
      collectedSui: token.collectedSui.toString(),
    };
    
    res.json(tokenResponse);
  } catch (error) {
    console.error('更新代币状态失败:', error);
    res.status(500).json({ error: '更新代币状态失败' });
  }
});

// 获取单个代币状态
app.get('/api/tokens/:type/status', async (req, res) => {
  try {
    const { type } = req.params;
    const token = await DatabaseService.getTokenStatus(type);
    
    if (!token) {
      return res.status(404).json({ error: '代币不存在' });
    }

    res.json({
      totalSupply: token.totalSupply.toString(),
      collectedSui: token.collectedSui.toString(),
      status: token.status
    });
  } catch (error) {
    console.error('获取代币状态失败:', error);
    res.status(500).json({ error: '获取代币状态失败' });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 