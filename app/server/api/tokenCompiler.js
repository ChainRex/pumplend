"use strict";
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
exports.generateAndCompileToken = generateAndCompileToken;
var child_process_1 = require("child_process");
var promises_1 = require("fs/promises");
var path_1 = require("path");
function generateAndCompileToken(config) {
    return __awaiter(this, void 0, void 0, function () {
        var moveCode, tempDirPath, tempFilePath, bytecode, dependencies;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    moveCode = generateMoveCode(config);
                    console.log(moveCode);
                    tempDirPath = path_1.default.join(process.cwd(), '../contracts/token_factory/sources');
                    return [4 /*yield*/, promises_1.default.mkdir(tempDirPath, { recursive: true })];
                case 1:
                    _a.sent();
                    tempFilePath = path_1.default.join(tempDirPath, "".concat(config.symbol.toLowerCase(), ".move"));
                    return [4 /*yield*/, promises_1.default.writeFile(tempFilePath, moveCode)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, , 6, 8]);
                    // 编译合约
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            (0, child_process_1.exec)('sui move build', {
                                cwd: path_1.default.join(process.cwd(), '../contracts/token_factory')
                            }, function (error, stdout, _) {
                                if (error) {
                                    reject(error);
                                    return;
                                }
                                resolve(stdout);
                            });
                        })];
                case 4:
                    // 编译合约
                    _a.sent();
                    return [4 /*yield*/, promises_1.default.readFile(path_1.default.join(process.cwd(), "../contracts/token_factory/build/token_factory/bytecode_modules/".concat(config.symbol.toLowerCase(), ".mv")))];
                case 5:
                    bytecode = _a.sent();
                    dependencies = [
                        "0x0000000000000000000000000000000000000000000000000000000000000001", // std
                        "0x0000000000000000000000000000000000000000000000000000000000000002" // sui
                    ];
                    return [2 /*return*/, {
                            bytecode: Array.from(bytecode),
                            dependencies: dependencies
                        }];
                case 6: 
                // 清理临时文件
                return [4 /*yield*/, promises_1.default.unlink(tempFilePath)];
                case 7:
                    // 清理临时文件
                    _a.sent();
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function generateMoveCode(config) {
    return "\nmodule token_factory::".concat(config.symbol.toLowerCase(), " {\n    use sui::coin::{Self, Coin, TreasuryCap};\n    use sui::url::{Self, Url};\n\n    public struct ").concat(config.symbol.toUpperCase(), " has drop {}\n\n    fun init(witness: ").concat(config.symbol.toUpperCase(), ", ctx: &mut TxContext) {\n        let (treasury_cap, metadata) = coin::create_currency<").concat(config.symbol.toUpperCase(), ">(\n            witness,\n            9,\n            b\"").concat(config.symbol, "\",\n            b\"").concat(config.name, "\",\n            b\"").concat(config.description, "\",\n            option::some<Url>(url::new_unsafe_from_bytes(b\"").concat(config.logoUrl, "\")),\n            ctx\n        );\n        transfer::public_freeze_object(metadata);\n        transfer::public_transfer(treasury_cap, tx_context::sender(ctx))\n    }\n\n    public entry fun mint(\n        treasury_cap: &mut TreasuryCap<").concat(config.symbol.toUpperCase(), ">,\n        amount: u64,\n        recipient: address,\n        ctx: &mut TxContext\n    ) {\n        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx);\n    }\n\n    public fun burn(\n        treasury_cap: &mut TreasuryCap<").concat(config.symbol.toUpperCase(), ">,\n        coin: Coin<").concat(config.symbol.toUpperCase(), ">\n    ) {\n        coin::burn(treasury_cap, coin);\n    }\n}");
}
