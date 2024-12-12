"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var tokenCompiler_1 = require("./api/tokenCompiler");
var database_1 = require("./services/database");
var app = (0, express_1.default)();
var port = 3000;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
app.post('/api/compile-token', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name_1, symbol, description, logoUrl, result, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, name_1 = _a.name, symbol = _a.symbol, description = _a.description, logoUrl = _a.logoUrl;
                return [4 /*yield*/, (0, tokenCompiler_1.generateAndCompileToken)({
                        name: name_1,
                        symbol: symbol,
                        description: description,
                        logoUrl: logoUrl
                    })];
            case 1:
                result = _b.sent();
                res.json(result);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                console.error('编译代币时出错:', error_1);
                res.status(500).json({ error: '代币编译失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 创建代币
app.post('/api/tokens', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var token, tokenResponse, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, database_1.DatabaseService.createToken(req.body)];
            case 1:
                token = _a.sent();
                tokenResponse = __assign(__assign({}, token), { totalSupply: token.totalSupply.toString(), collectedSui: token.collectedSui.toString() });
                res.json(tokenResponse);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                console.error('创建代币失败:', error_2);
                res.status(500).json({ error: '创建代币失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 获取所有代币列表
app.get('/api/tokens', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tokens, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, database_1.DatabaseService.getAllTokens()];
            case 1:
                tokens = _a.sent();
                console.log("获取代币列表成功:", tokens);
                res.json(tokens);
                return [3 /*break*/, 3];
            case 2:
                error_3 = _a.sent();
                console.error('获取代币列表失败:', error_3);
                res.status(500).json({ error: '获取代币列表失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 更新代币状态
app.post('/api/tokens/:type/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, _a, totalSupply, collectedSui, status_1, token, tokenResponse, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                type = req.params.type;
                _a = req.body, totalSupply = _a.totalSupply, collectedSui = _a.collectedSui, status_1 = _a.status;
                console.log("更新代币状态:", totalSupply, collectedSui, status_1);
                return [4 /*yield*/, database_1.DatabaseService.updateTokenStatus(type, BigInt(totalSupply), BigInt(collectedSui), status_1)];
            case 1:
                token = _b.sent();
                tokenResponse = __assign(__assign({}, token), { totalSupply: token.totalSupply.toString(), collectedSui: token.collectedSui.toString() });
                res.json(tokenResponse);
                return [3 /*break*/, 3];
            case 2:
                error_4 = _b.sent();
                console.error('更新代币状态失败:', error_4);
                res.status(500).json({ error: '更新代币状态失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 获取单个代币状态
app.get('/api/tokens/:type/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, token, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                type = req.params.type;
                return [4 /*yield*/, database_1.DatabaseService.getTokenStatus(type)];
            case 1:
                token = _a.sent();
                if (!token) {
                    return [2 /*return*/, res.status(404).json({ error: '代币不存在' })];
                }
                res.json({
                    totalSupply: token.totalSupply.toString(),
                    collectedSui: token.collectedSui.toString(),
                    status: token.status
                });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                console.error('获取代币状态失败:', error_5);
                res.status(500).json({ error: '获取代币状态失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 更新池子信息
app.post('/api/tokens/:type/pool', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, _a, poolId, positionId, tickLower, tickUpper, liquidity, token, error_6;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                type = req.params.type;
                _a = req.body, poolId = _a.poolId, positionId = _a.positionId, tickLower = _a.tickLower, tickUpper = _a.tickUpper, liquidity = _a.liquidity;
                return [4 /*yield*/, database_1.DatabaseService.updateTokenPool(type, {
                        poolId: poolId,
                        positionId: positionId,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        liquidity: liquidity
                    })];
            case 1:
                token = _b.sent();
                res.json(token);
                return [3 /*break*/, 3];
            case 2:
                error_6 = _b.sent();
                console.error('Failed to update pool info:', error_6);
                res.status(500).json({ error: 'Failed to update pool info' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 获取池子信息
app.get('/api/tokens/:type/pool', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, poolInfo, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                type = req.params.type;
                return [4 /*yield*/, database_1.DatabaseService.getTokenPool(type)];
            case 1:
                poolInfo = _a.sent();
                if (!(poolInfo === null || poolInfo === void 0 ? void 0 : poolInfo.poolId)) {
                    return [2 /*return*/, res.status(404).json({ error: 'Pool not found' })];
                }
                res.json(poolInfo);
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                console.error('Failed to get pool info:', error_7);
                res.status(500).json({ error: 'Failed to get pool info' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 创建借贷池记录
app.post('/api/lendings', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name_2, symbol, type, icon, metadataId, lendingPoolId, ltv, liquidation_threshold, existing, lending, error_8;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                _a = req.body, name_2 = _a.name, symbol = _a.symbol, type = _a.type, icon = _a.icon, metadataId = _a.metadataId, lendingPoolId = _a.lendingPoolId, ltv = _a.ltv, liquidation_threshold = _a.liquidation_threshold;
                return [4 /*yield*/, database_1.DatabaseService.getLending(type)];
            case 1:
                existing = _b.sent();
                if (existing) {
                    return [2 /*return*/, res.status(400).json({ error: '该代币已创建借贷池' })];
                }
                return [4 /*yield*/, database_1.DatabaseService.createLending({
                        name: name_2,
                        symbol: symbol,
                        type: type,
                        icon: icon,
                        metadataId: metadataId,
                        lendingPoolId: lendingPoolId,
                        ltv: ltv,
                        liquidation_threshold: liquidation_threshold
                    })];
            case 2:
                lending = _b.sent();
                res.json(lending);
                return [3 /*break*/, 4];
            case 3:
                error_8 = _b.sent();
                console.error('创建借贷池记录失败:', error_8);
                res.status(500).json({ error: '创建借贷池记录失败' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// 获取借贷池信息
app.get('/api/lendings/:type', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var type, lending, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                type = req.params.type;
                return [4 /*yield*/, database_1.DatabaseService.getLending(type)];
            case 1:
                lending = _a.sent();
                if (!lending) {
                    return [2 /*return*/, res.status(404).json({ error: '借贷池不存在' })];
                }
                res.json(lending);
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                console.error('获取借贷池信息失败:', error_9);
                res.status(500).json({ error: '获取借贷池信息失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 获取所有借贷池列表
app.get('/api/lendings', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var lendings, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, database_1.DatabaseService.getAllLendings()];
            case 1:
                lendings = _a.sent();
                res.json(lendings);
                return [3 /*break*/, 3];
            case 2:
                error_10 = _a.sent();
                console.error('获取借贷池列表失败:', error_10);
                res.status(500).json({ error: '获取借贷池列表失败' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
app.listen(port, '0.0.0.0', function () {
    console.log("\u670D\u52A1\u5668\u8FD0\u884C\u5728 http://0.0.0.0:".concat(port));
});
