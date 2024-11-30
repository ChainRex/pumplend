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
// 创建代币
app.post('/api/tokens', async (req, res) => {
  try {
    const token = await DatabaseService.createToken(req.body);
    res.json(token);
  } catch (error) {
    console.error('创建代币失败:', error);
    res.status(500).json({ error: '创建代币失败' });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 