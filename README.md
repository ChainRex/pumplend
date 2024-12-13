<!-- PROJECT LOGO -->
<br />

<p align="center">
  <h1 align="center">PumpLend</h1>
  <p align="center">
    一个代币发行和借贷平台
    <br />
    <a href="https://www.pumplend.app">查看Demo</a>
    ·
    <a href="https://github.com/ChainRex/pumplend/issues">报告Bug</a>
    ·
    <a href="https://github.com/ChainRex/pumplend/issues">提出新特性</a>
  </p>
</p>
<!-- PROJECT SHIELDS -->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

PumpLend 是一个代币发行和借贷平台，部署在 Sui 区块链上。部署者可以通过简单的操作发行代币，并可以立即在 Bonding Curve 曲线上购买它，当足够多的用户购买了代币，平台会将流动性存入去中心化交易所 Cetus。与一般代币发行平台不同的是，平台会在转移流动性前，从初始流动性中抽取 3% 的流动性，捐赠到借贷池中。这部分资金将用于提升存款利率，较高的存款利率会吸引用户购买代币并存入借贷池中，将有利于代币价格的提升。当代币的市值达到一定数量后，将开放代币作为抵押品，从而释放代币的流动性，并允许借出代币。

## 目录

- [上手指南](#上手指南)
  - [开发前的配置要求](#开发前的配置要求)
  - [安装步骤](#安装步骤)
- [PumpLend 工作原理](#pumplend-工作原理)
  - [代币发行](#代币发行)
  - [代币募资](#代币募资)
    - [什么是 Bonding Curve](#什么是-bonding-curve)
  - [创建 CETUS 流动性池](#创建-cetus-流动性池)
  - [代币借贷](#代币借贷)
    - [价格与价值计算](#价格与价值计算)
    - [抵押、借款与限制](#抵押、借款与限制)
    - [多代币健康因子 (HF) 计算](#多代币健康因子-(HF)-计算)
    - [清算机制与激励](#清算机制与激励)
    - [利率模型](#利率模型)
- [贡献者](#贡献者)
  - [如何参与开源项目](#如何参与开源项目)
- [版本控制](#版本控制)
- [版权说明](#版权说明)
- [鸣谢](#鸣谢)

### 上手指南

###### 开发前的配置要求

1. 安装 Sui
2. Node.js v20.18.0
3. PostgreSQL 数据库

###### **安装步骤**

**前端**

```sh
$ cd app

# install dependencies
$ npm install

# start the app
$ npm run dev
```

**后端**

```sh

# Copy environment configuration file
$ cp .env.example .env

# Configure database connection URL
DATABASE_URL="postgresql://username:password@localhost:5432/pumplend?schema=public"

# Create PostgreSQL database
$ createdb pumplend

# Run database migrations
$ npx prisma migrate dev

# Start development server
$ tsx server/index.ts

```

**合约**

```sh
$ cd contracts/pumplend

$ sui client publish --skip-dependency-verification
```

<!-- ### 文件目录说明

eg:

```
filetree
├── ARCHITECTURE.md
├── LICENSE.txt
├── README.md
├── /account/
├── /bbs/
├── /docs/
│  ├── /rules/
│  │  ├── backend.txt
│  │  └── frontend.txt
├── manage.py
├── /oa/
├── /static/
├── /templates/
├── useless.md
└── /util/

```

### 开发的架构

请阅读[ARCHITECTURE.md](https://github.com/ChainRex/pumplend/blob/master/ARCHITECTURE.md) 查阅为该项目的架构。

### 部署

暂无

### 使用到的框架

- [xxxxxxx](https://getbootstrap.com)
- [xxxxxxx](https://jquery.com)
- [xxxxxxx](https://laravel.com) -->

### PumpLend 工作原理

#### 代币发行

用户可以在 Create Token 界面免费发行代币，只需要输入代币的基本信息(Name, Symbol, Logo URL, Description)，并支付少量 gas 费即可发行代币。发行后的代币可以在 Trade 界面进行交易，初始价格为 0.0000018 SUI/Token。

#### 代币募资

代币发行后即进入募资阶段，用户可以使用 SUI 铸造并购买一定数量的代币，也可以出售并销毁代币拿回 SUI。在募资阶段使用 Bonding Curve 进行定价，代币价格会随着代币供应量的增加迅速上升，这将给早期投资者带来丰厚的利润。募资的目标为 20,000 SUI，此时代币的供应量将达到 800,000,000，价格为 0.0001 SUI/Token。

##### 什么是 Bonding Curve

Bonding Curve 是一条描述代币价格与代币供应量关系的函数曲线，它可以表示为 $y=a \cdot e^{bx}$，其中

- $y$：代币的价格
- $x$：代币的供给量
- $a$：初始价格
- $b$：指数增长率

![Bonding Curve](imgs/bonding_curve.png)

当代币供给从 $x_0$ 增长 $\Delta x$ 到 $x_1=x_0+\Delta x$, 所需要的资金量为

$$
\Delta y = \int_{x_0}^{x_1} a \cdot e^{b \cdot x} \, dx
$$

可得：

$$
\Delta y = \frac{a \cdot \left(e^{b \cdot (x_0+\Delta x)} - e^{b \cdot x_0}\right)}{b}
$$

通过这 公式，我们可以推导 $\Delta x$ 的表达式：

$$
\begin{align}
\Delta y &= \frac{a \cdot \left(e^{b \cdot (x_0 + \Delta x)} - e^{b \cdot x_0}\right)}{b} \\
\frac{b \cdot \Delta y}{a} &= e^{b \cdot (x_0 + \Delta x)} - e^{b \cdot x_0} \\
\frac{b \cdot \Delta y}{a} + e^{b \cdot x_0} &= e^{b \cdot (x_0 + \Delta x)} \\
b \cdot (x_0 + \Delta x) &= \ln\left(\frac{b \cdot \Delta y}{a} + e^{b \cdot x_0}\right) \\
\Delta x &= \frac{1}{b} \cdot \ln\left(\frac{b \cdot \Delta y}{a} + e^{b \cdot x_0}\right) - x_0
\end{align}
$$

同理，当代币供给从 $x_1$ 减少 $\Delta x$ 到 $x_0=x_1-\Delta x$ 时，可以获得的资金量为:

$$
\Delta y = \frac{a \cdot \left(e^{b \cdot x_1} - e^{b \cdot (x_1-\Delta x)}\right)}{b}
$$

通过这个公式，我们可以推导出卖出代币数量 $\Delta x$ 的表达式：

$$
\begin{align}
\Delta y &= \frac{a \cdot \left(e^{b \cdot x_1} - e^{b \cdot (x_1-\Delta x)}\right)}{b} \\
\frac{b \cdot \Delta y}{a} &= e^{b \cdot x_1} - e^{b \cdot (x_1-\Delta x)} \\
e^{b \cdot (x_1-\Delta x)} &= e^{b \cdot x_1} - \frac{b \cdot \Delta y}{a} \\
b \cdot (x_1-\Delta x) &= \ln\left(e^{b \cdot x_1} - \frac{b \cdot \Delta y}{a}\right) \\
\Delta x &= x_1 - \frac{1}{b} \cdot \ln\left(e^{b \cdot x_1} - \frac{b \cdot \Delta y}{a}\right)
\end{align}
$$

由于 Move 不支持浮点数运算，需要使用定点数来处理小数。具体实现见[bonding_curve.move](contracts/pumplend/sources/bonding_curve.move)。

#### 创建 CETUS 流动性池

当代币达到募资目标时，将会铸造 200,000,000 代币，与募集到的 20,000 SUI 一起添加到 Cetus 流动性池。

#### 代币借贷

当代币达到募资价格后，为了吸引用户购买代币，PumpLend 将会从初始流动性中抽取 3% 的代币(600 SUI 和 6,000,000 Token) 捐赠到借贷池中。这一部分资金用来提升存款利率，较高的存款利率会吸引用户购买代币并存入借贷池中，将有利于代币价格的提升。当代币价格达到 0.0125 SUI/Token 时，将开放代币作为抵押品，从而释放代币的流动性，并允许借出代币，如此时捐赠的资金还有剩余，也将用于借款利率的折扣。

##### 价格与价值计算

###### 价格来源

每种新代币与 SUI 的 CETUS 池中记录了以下数量：

- $X_i$：该代币 $i$ 对应的 SUI 数量
- $Y_i$：该代币 $i$ 对应的代币数量

代币 $i$ 的价格近似为：

$$
\text{价格}_i = \frac{X_i}{Y_i} \quad (\text{SUI/Token})
$$

由于协议的特殊性，目前只能部署在测试网上，因此无法使用预言机作为价格源。本协议也为上线主网提供了备用方案：

1. 增加多种主流加密货币的借贷，例如 WBTC、WETH、USDC
2. 协议改为美元计价并使用 Pyth 等预言机提供价格源
3. 当新代币市值达到 5000 万美元并由 Pyth 提供喂价服务后方可开启抵押品和借款服务，否则，只开放存款服务

##### 抵押、借款与限制

用户可抵押 SUI 或新代币以借出 SUI 或新代币。本协议为不同资产设置不同的抵押率（LTV）：

- **SUI 抵押率 (LTV_SUI)**：60%
- **新代币抵押率 (LTV_token)**：20%

**最大可借款价值**（以 SUI 计）:

$$
V_{borrow}^{max} = \sum_j (V_{C_j} \times LTV_{C_j})
$$

其中:

- $V_{C_j}$ 是抵押物 $j$ 的价值（以 SUI 计）
- $LTV_{C_j}$ 是抵押物 $j$ 的抵押率（SUI 为 60%，新代币为 20%）

例如：

- 用户抵押 100 SUI 和价值 100 SUI 的新代币
- 最大可借款价值 = $100 \times 60\% + 100 \times 20\% = 80$ SUI

为避免新代币价格波动过大，清算不及时导致坏账，协议规定：

1. 当代币价格低于 0.0125 SUI/Token 时，不开放借款服务，并且无法作为抵押品
2. 当代币价格大于 0.0125 SUI/Token 并开放借款后，此时依旧存在代币价格大幅上升的风险，因此在借出非 SUI 代币时，将按照以下公式计算可借出的代币价值：

$$
\frac{\sum_j (V_{C_j} \times LTV_{C_j}) - (V_{Borrow}^{SUI} + TokenDebtMultiplier \times \sum_k V_{Borrow}^{Token_k})}{TokenDebtMultiplier}
$$

其中：

- $V_{C_j}$ 是抵押物 $j$ 的价值（以 SUI 计）
- $LTV_{C_j}$ 是抵押物 $j$ 的抵押率（SUI 为 60%，新代币为 20%）
- $V_{Borrow}^{SUI}$ 是借出的 SUI 价值
- $V_{Borrow}^{Token_k}$ 是借出的第 $k$ 种代币的价值（以 SUI 计）
- $TokenDebtMultiplier$ 是非 SUI 代币的债务乘数（定义为 3 倍），该系数仅用于降低杠杆率，不对实际的债务价值产生影响，也不影响健康因子的计算

##### 多代币健康因子 (HF) 计算

为了考虑多资产抵押和借款的风险水平，引入健康因子 (Health Factor, HF)。HF 综合考虑用户的所有抵押品和借款，判断是否可被清算。

- 定义抵押物集合 $\{C_j\}$，每种抵押物都有一个清算阈值 $T_{C_j}$（SUI 为 85%，新代币为 70%）。
- 定义借款集合 $\{B_k\}$，将所有借款折算为 SUI 价值 $V_{B_k}$。总借款价值为：

$$
V_{borrow}^{total} = \sum_k V_{B_k}
$$

**健康因子计算**：

$$
HF = \frac{\sum_j (V_{C_j} \times T_{C_j})}{V_{borrow}^{total}}
$$

当 $HF < 1$ 时，用户的抵押物（按清算阈值计）不足以覆盖所借资产，清算人可对其头寸进行清算。

##### 清算机制与激励

当用户的健康因子 $HF < 1$ 时，清算人可以对其头寸进行清算。清算机制设计如下：

1. **清算触发条件**：
   - 健康因子 $HF < 1$
   - 非 SUI 资产价格必须在 15 秒内更新过

2. **清算限制**：
   - 单次清算最多可清算用户 50% 的债务
   - 清算人需要支付相应的债务代币来获得抵押品

3. **清算奖励**：
   - 清算人可以获得 20% 的清算折扣
   - 例如：如果债务价值是 100 SUI，清算人只需支付 80 SUI 就能获得 100 SUI 价值的抵押品

4. **清算流程**：
   - 清算人选择要清算的债务代币和想要获得的抵押品代币
   - 系统根据清算折扣计算清算人需要支付的债务代币数量和可获得的抵押品数量
   - 清算人支付债务代币，系统将抵押品转给清算人
   - 被清算用户的债务和抵押品相应减少

##### 利率模型

###### 基础利率

采用分段线性利率模型，根据资金池的利用率动态调整利率。

1. **利用率计算**：

$$
U = \frac{\text{总借款}}{\text{总存款}}
$$

2. **分段利率模型**：
   - 设定最优利用率 $U_{optimal} = 50\%$
   - 当 $U \leq U_{optimal}$ 时，利率线性增长： 
  
$$
R_{borrow} = \frac{R_{slope1} \times U}{U_{optimal}}
$$

   - 当 $U > U_{optimal}$ 时，利率加速增长：
  
      
$$
R_{borrow} = R_{slope1} + \frac{R_{slope2} \times (U - U_{optimal})}{1 - U_{optimal}}
$$

   其中：
   - $R_{slope1}$：第一阶段斜率
   - $R_{slope2}$：第二阶段斜率（更陡）

3. **存款利率计算**：
   存款利率 = 借款利率 × (1 - 储备金率)


$$
R_{supply} = R_{borrow} \times (1 - R_{reserve})
$$

###### 奖励利率

在基础利率模型的基础上，本协议引入了额外的奖励利率，用以激励用户存入资产并在一定条件下降低借款成本。该奖励利率的来源主要是初始阶段从流动性池中抽取出来的捐赠资金，通过动态调整，确保在早期有足够的奖励来吸引存款者，同时在资金被借用和消耗的过程中，奖励利率会逐步减弱。

**奖励利率的触发与作用**

1. **额外存款利率奖励**  
   当借贷池中尚有未消耗的捐赠资金时，系统会根据剩余捐赠资金的比例，给予存款者额外的利率奖励。这一措施能在早期大幅提高存款利率，激励用户将代币存入池中，从而推高代币价格。

2. **借款利率折扣**  
   当代币开放借款服务且捐赠资金较为充裕时，系统亦会对借款者给出一定的借款利率折扣，以降低借款成本。该折扣将逐渐随捐赠资金的消耗而减小，直到不再提供折扣。通过给予借款利率折扣，可以吸引更多的借款需求，从而推动资金利用率的均衡。

**奖励利率的动态调整逻辑**

奖励利率的核心在于其动态性，根据剩余捐赠储备在总捐赠中的比例对奖励和折扣进行调整。

- **捐赠总量 ($totalDonations$)**：初始时从流动性池中抽取的总捐赠量。
- **捐赠储备 ($donationReserves$)**：当前尚未被用于奖励或折扣的剩余捐赠资金。

计算公式如下：

1. **捐赠比例 ($donationRatio$)**：


$$
donationRatio = \frac{donationReserves}{totalDonations}
$$

2. **额外存款奖励利率 ($extraSupplyInterestRateBonus$)**：
   初始时设定一个奖励利率上限 $supplyInterestRateBonusInitial$，再根据当前 $donationRatio$ 比例线性缩放。

$$
newSupplyBonus = supplyInterestRateBonusInitial \times donationRatio
$$

   若计算结果低于最低门槛 0.5%，则奖励直接归零。

3. **借款利率折扣 ($borrowInterestRateDiscount$)**：
   与额外存款奖励类似，对借款利率折扣以相同的方式缩放：

$$
newBorrowDiscount = borrowInterestRateDiscountInitial \times donationRatio
$$

   同样的，若计算结果低于最低门槛 0.5%，则折扣设为 0。

### 贡献者

请阅读[CONTRIBUTING.md](CONTRIBUTING.md)查阅为该项目做出贡献的开发者。

#### 如何参与开源项目

贡献使开源社区成为一个学习、激励和创造的绝佳场所。你所作的任何贡献都是**非常感谢**的。

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 版本控制

该项目使用 Git 进行版本管理。您可以在 repository 参看当前可用版本。

### 版权说明

该项目签署了 MIT 授权许可，详情请参阅 [LICENSE](https://github.com/ChainRex/pumplend/blob/master/LICENSE)

### 鸣谢

- [Mysten Labs](https://github.com/MystenLabs)
- [Navi Protocol](https://github.com/naviprotocol)
- [Cetus Protocol](https://github.com/CetusProtocol)
- [Tamago Labs](https://github.com/tamago-labs)
<!-- links -->

[your-project-path]: ChainRex/pumplend
[contributors-shield]: https://img.shields.io/github/contributors/ChainRex/pumplend.svg?style=flat-square
[contributors-url]: https://github.com/ChainRex/pumplend/contributors
[forks-shield]: https://img.shields.io/github/forks/ChainRex/pumplend.svg?style=flat-square
[forks-url]: https://github.com/ChainRex/pumplend/network/members
[stars-shield]: https://img.shields.io/github/stars/ChainRex/pumplend.svg?style=flat-square
[stars-url]: https://github.com/ChainRex/pumplend/stargazers
[issues-shield]: https://img.shields.io/github/issues/ChainRex/pumplend.svg?style=flat-square
[issues-url]: https://img.shields.io/github/issues/ChainRex/pumplend.svg
[license-shield]: https://img.shields.io/github/license/ChainRex/pumplend.svg?style=flat-square
[license-url]: https://github.com/ChainRex/pumplend/blob/master/LICENSE
