import express from 'express';
import cors from 'cors';
import { generateAndCompileToken } from './api/tokenCompiler';
import { DatabaseService } from './services/database';

const app = express();
const port = 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'https://pumplend.app', 'https://www.pumplend.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.options('*', cors());

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

// 更新池子信息
app.post('/api/tokens/:type/pool', async (req, res) => {
  try {
    const { type } = req.params;
    const {
      poolId,
      positionId,
      tickLower,
      tickUpper,
      liquidity
    } = req.body;
    
    const token = await DatabaseService.updateTokenPool(type, {
      poolId,
      positionId,
      tickLower,
      tickUpper,
      liquidity
    });
    
    res.json(token);
  } catch (error) {
    console.error('Failed to update pool info:', error);
    res.status(500).json({ error: 'Failed to update pool info' });
  }
});

// 获取池子信息
app.get('/api/tokens/:type/pool', async (req, res) => {
  try {
    const { type } = req.params;
    const poolInfo = await DatabaseService.getTokenPool(type);
    
    if (!poolInfo?.poolId) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    res.json(poolInfo);
  } catch (error) {
    console.error('Failed to get pool info:', error);
    res.status(500).json({ error: 'Failed to get pool info' });
  }
});

// 创建借贷池记录
app.post('/api/lendings', async (req, res) => {
  try {
    const { name, symbol, type, icon, metadataId, lendingPoolId, ltv, liquidation_threshold } = req.body;
    
    // 检查是否已存在
    const existing = await DatabaseService.getLending(type);
    if (existing) {
      return res.status(400).json({ error: '该代币已创建借贷池' });
    }

    const lending = await DatabaseService.createLending({
      name,
      symbol,
      type,
      icon,
      metadataId,
      lendingPoolId,
      ltv,
      liquidation_threshold
    });
    
    res.json(lending);
  } catch (error) {
    console.error('创建借贷池记录失败:', error);
    res.status(500).json({ error: '创建借贷池记录失败' });
  }
});

// 获取借贷池信息
app.get('/api/lendings/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const lending = await DatabaseService.getLending(type);
    
    if (!lending) {
      return res.status(404).json({ error: '借贷池不存在' });
    }
    
    res.json(lending);
  } catch (error) {
    console.error('获取借贷池信息失败:', error);
    res.status(500).json({ error: '获取借贷池信息失败' });
  }
});

// 获取所有借贷池列表
app.get('/api/lendings', async (req, res) => {
  try {
    const lendings = await DatabaseService.getAllLendings();
    res.json(lendings);
  } catch (error) {
    console.error('获取借贷池列表失败:', error);
    res.status(500).json({ error: '获取借贷池列表失败' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${port}`);
});