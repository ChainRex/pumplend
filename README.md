# PumpSui

PumpSui 是一个 Meme 代币发行和借贷平台，部署在 Sui 区块链上。它的独特之处在于允许用户利用代币的初始流动性进行借贷操作，为 Meme 生态带来全新的可能性。

<!-- PROJECT SHIELDS -->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />

<p align="center">
  <h3 align="center">PumpSui</h3>
  <p align="center">
    一个 Meme 代币发行和借贷平台
    <br />
    <a href="http://pumpsui.org">查看Demo</a>
    ·
    <a href="https://github.com/ChainRex/pumpsui/issues">报告Bug</a>
    ·
    <a href="https://github.com/ChainRex/pumpsui/issues">提出新特性</a>
  </p>
</p>

## 目录

- [上手指南](#上手指南)
  - [开发前的配置要求](#开发前的配置要求)
  - [安装步骤](#安装步骤)
- [PumpSui 工作原理](#pumpsui-工作原理)
  - [代币发行](#代币发行)
  - [代币募资](#代币募资)
    - [什么是 Bonding Curve](#什么是-bonding-curve)
  - [创建 CETUS 流动性池](#创建-cetus-流动性池)
  - [代币借贷](#代币借贷)
- [贡献者](#贡献者)
  - [如何参与开源项目](#如何参与开源项目)
- [版本控制](#版本控制)
- [作者](#作者)
- [版权说明](#版权说明)
- [鸣谢](#鸣谢)

### 上手指南

###### 开发前的配置要求

1. 安装 Sui
2. Node.js v20.18.0

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
略
```

**合约**

```sh
略
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

请阅读[ARCHITECTURE.md](https://github.com/ChainRex/pumpsui/blob/master/ARCHITECTURE.md) 查阅为该项目的架构。

### 部署

暂无

### 使用到的框架

- [xxxxxxx](https://getbootstrap.com)
- [xxxxxxx](https://jquery.com)
- [xxxxxxx](https://laravel.com) -->

### PumpSui 工作原理

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

<div align="center">
<img src="https://latex.codecogs.com/svg.latex?\Delta%20y%20=%20\int_{x_0}^{x_1}%20a%20\cdot%20e^{b%20\cdot%20x}%20\,%20dx" />
</div>

可得：

<div align="center">
<img src="https://latex.codecogs.com/svg.latex?\Delta%20y%20=%20\frac{a%20\cdot%20\left(e^{b%20\cdot%20(x_0+\Delta%20x)}%20-%20e^{b%20\cdot%20x_0}\right)}{b}" />
</div>

通过这 公式，我们可以推导 $\Delta x$ 的表达式：

<div align="center">
<img src="https://latex.codecogs.com/svg.latex?\begin{align}\Delta%20y%20&=%20\frac{a%20\cdot%20\left(e^{b%20\cdot%20(x_0%20+%20\Delta%20x)}%20-%20e^{b%20\cdot%20x_0}\right)}{b}\\\frac{b%20\cdot%20\Delta%20y}{a}%20&=%20e^{b%20\cdot%20(x_0%20+%20\Delta%20x)}%20-%20e^{b%20\cdot%20x_0}\\%20\frac{b%20\cdot%20\Delta%20y}{a}%20+%20e^{b%20\cdot%20x_0}%20&=e^{b%20\cdot%20(x_0%20+%20\Delta%20x)}%20\\b%20\cdot%20(x_0%20+%20\Delta%20x)%20&=%20\ln\left(\frac{b%20\cdot%20\Delta%20y}{a}%20+%20e^{b%20\cdot%20x_0}\right)\\\Delta%20x%20&=%20\frac{1}{b}%20\cdot%20\ln\left(\frac{b%20\cdot%20\Delta%20y}{a}%20+%20e^{b%20\cdot%20x_0}\right)%20-%20x_0\end{align}" />
</div>

同理，当代币供给从 $x_1$ 减少 $\Delta x$ 到 $x_0=x_1-\Delta x$ 时，可以获得的资金量为:

<div align="center">
<img src="https://latex.codecogs.com/svg.latex?\Delta%20y%20=%20\frac{a%20\cdot%20\left(e^{b%20\cdot%20x_1}%20-%20e^{b%20\cdot%20(x_1-\Delta%20x)}\right)}{b}" />
</div>

通过这个公式，我们可以推导出卖出代币数量 $\Delta x$ 的表达式：

<div align="center">
<img src="https://latex.codecogs.com/svg.latex?\begin{align}\Delta%20y%20&=%20\frac{a%20\cdot%20\left(e^{b%20\cdot%20x_1}%20-%20e^{b%20\cdot%20(x_1-\Delta%20x)}\right)}{b}\\\frac{b%20\cdot%20\Delta%20y}{a}%20&=%20e^{b%20\cdot%20x_1}%20-%20e^{b%20\cdot%20(x_1-\Delta%20x)}\\e^{b%20\cdot%20(x_1-\Delta%20x)}%20&=%20e^{b%20\cdot%20x_1}%20-%20\frac{b%20\cdot%20\Delta%20y}{a}\\b%20\cdot%20(x_1-\Delta%20x)%20&=%20\ln\left(e^{b%20\cdot%20x_1}%20-%20\frac{b%20\cdot%20\Delta%20y}{a}\right)\\\Delta%20x%20&=%20x_1%20-%20\frac{1}{b}%20\cdot%20\ln\left(e^{b%20\cdot%20x_1}%20-%20\frac{b%20\cdot%20\Delta%20y}{a}\right)\end{align}" />
</div>

由于 Move 不支持浮点数运算，需要使用定点数来处理小数。具体实现见[bonding_curve.move](contracts/pumpsui/sources/bonding_curve.move)。

#### 创建 CETUS 流动性池

当代币达到募资目标时，将会铸造 200,000,000 代币，与募集到的 20,000 SUI 一起添加到 Cetus 流动性池。

#### 代币借贷

PumpSui 采用创新的借贷机制，利用代币的初始流动性来支持借贷操作。在添加 Cetus 流动性前，将初始流动性的 10%(2,000 SUI 和 20,000,000 Token)存入借贷池中。具体方案见[Lending.md](Lending.md)

### 贡献者

<!-- 请阅读**CONTRIBUTING.md** 查阅为该项目做出贡献的开发者。 -->

#### 如何参与开源项目

贡献使开源社区成为一个学习、激励和创造的绝佳场所。你所作的任何贡献都是**非常感谢**的。

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 版本控制

该项目使用 Git 进行版本管理。您可以在 repository 参看当前可用版本。

### 作者

ChainRex

_您也可以在贡献者名单中参看所有参与该项目的开发者。_

### 版权说明

该项目签署了 MIT 授权许可，详情请参阅 [LICENSE](https://github.com/ChainRex/pumpsui/blob/master/LICENSE)

### 鸣谢

- [Mysten Labs](https://github.com/MystenLabs)
- [Navi Protocol](https://github.com/naviprotocol)
- [Cetus Protocol](https://github.com/CetusProtocol)
- [Tamago Labs](https://github.com/tamago-labs)
<!-- links -->

[your-project-path]: ChainRex/pumpsui
[contributors-shield]: https://img.shields.io/github/contributors/ChainRex/pumpsui.svg?style=flat-square
[contributors-url]: https://github.com/ChainRex/pumpsui/contributors
[forks-shield]: https://img.shields.io/github/forks/ChainRex/pumpsui.svg?style=flat-square
[forks-url]: https://github.com/ChainRex/pumpsui/network/members
[stars-shield]: https://img.shields.io/github/stars/ChainRex/pumpsui.svg?style=flat-square
[stars-url]: https://github.com/ChainRex/pumpsui/stargazers
[issues-shield]: https://img.shields.io/github/issues/ChainRex/pumpsui.svg?style=flat-square
[issues-url]: https://img.shields.io/github/issues/ChainRex/pumpsui.svg
[license-shield]: https://img.shields.io/github/license/ChainRex/pumpsui.svg?style=flat-square
[license-url]: https://github.com/ChainRex/pumpsui/blob/master/LICENSE
