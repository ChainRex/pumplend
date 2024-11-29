import express from 'express';
import cors from 'cors';
import { generateAndCompileToken } from './api/tokenCompiler';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/compile-token', async (req, res) => {
  try {
    const { name, symbol, description, logoUrl } = req.body;
    console.log(name, symbol, description, logoUrl);
    
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

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 