module pumpsui::lending_core {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::event;
    use cetus_clmm::pool::{Self, Pool as CetusPool};
    use std::vector;
    use testsui::testsui::{ TESTSUI };

    // === 错误码 ===
    const E_NOT_IMPLEMENTED: u64 = 0;
    const E_INVALID_POOL_TOKEN: u64 = 1;
    const E_TESTSUI_NO_NEED_POOL: u64 = 2;

    // === 常量 ===
    // LTV
    const SUI_LTV: u64 = 60; // 60%
    const TOKEN_LTV: u64 = 20; // 20%

    // 清算阈值
    const SUI_LIQUIDATION_THRESHOLD: u64 = 85; // 85%
    const TOKEN_LIQUIDATION_THRESHOLD: u64 = 70; // 70%

    // 清算奖励
    const LIQUIDATION_BONUS: u64 = 10; // 10%

    // === 结构体 ===
    public struct LendingPool<phantom CoinType> has key {
        id: UID,
        // 存款总额
        total_deposits: Balance<CoinType>,
        // 借款总额
        total_borrows: Balance<CoinType>,
        // 累计利率
        borrow_rate: u64,
        // 最后更新时间
        last_update_time: u64,
    }

    public struct UserPosition has key, store {
        id: UID,
        // 用户地址
        user: address,
        // 存款金额 (asset_type => amount)
        deposits: vector<u64>,
        // 借款金额 (asset_type => amount)
        borrows: vector<u64>,
    }

    public struct AssetInfo has store, copy {
        asset_type: u8,
        ltv: u64,
        liquidation_threshold: u64,
    }

    public struct LendingStorage has key {
        id: UID,
        // 支持的资产列表
        supported_assets: vector<AssetInfo>,
        // 用户仓位 (user => UserPosition)
        user_positions: Table<address, UserPosition>
    }

    // === 事件 ===
    public struct DepositEvent has copy, drop {
        user: address,
        asset: u8,
        amount: u64
    }

    public struct WithdrawEvent has copy, drop {
        user: address,
        asset: u8,
        amount: u64
    }

    public struct BorrowEvent has copy, drop {
        user: address,
        asset: u8,
        amount: u64
    }

    public struct RepayEvent has copy, drop {
        user: address,
        asset: u8,
        amount: u64
    }

    public struct LiquidationEvent has copy, drop {
        liquidator: address,
        user: address,
        debt_asset: u8,
        collateral_asset: u8,
        debt_amount: u64,
        collateral_amount: u64
    }

    // === 公共函数 ===
    public entry fun deposit_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        asset: u8,
        deposit_coin: Coin<TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun deposit_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        asset: u8,
        deposit_coin: Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun withdraw_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        asset: u8,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun withdraw_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        asset: u8,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun borrow_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        asset: u8,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun borrow_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        asset: u8,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun repay_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        asset: u8,
        repay_coin: Coin<TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    public entry fun repay_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        asset: u8,
        repay_coin: Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    // TESTSUI 清算 Token
    public entry fun liquidate_testsui_token<CollateralCoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        debt_pool: &mut LendingPool<TESTSUI>,
        debt_asset: u8,
        debt_coin: Coin<TESTSUI>,
        collateral_pool: &mut LendingPool<CollateralCoinType>,
        collateral_asset: u8,
        cetus_pool: &CetusPool<CollateralCoinType, TESTSUI>,
        liquidate_user: address,
        liquidate_amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    // Token 清算 TESTSUI
    public entry fun liquidate_token_testsui<DebtCoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        debt_pool: &mut LendingPool<DebtCoinType>,
        debt_asset: u8,
        debt_coin: Coin<DebtCoinType>,
        collateral_pool: &mut LendingPool<TESTSUI>,
        collateral_asset: u8,
        cetus_pool: &CetusPool<DebtCoinType, TESTSUI>,
        liquidate_user: address,
        liquidate_amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    // Token 清算 Token
    public entry fun liquidate_token_token<DebtCoinType, CollateralCoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        debt_pool: &mut LendingPool<DebtCoinType>,
        debt_asset: u8,
        debt_coin: Coin<DebtCoinType>,
        collateral_pool: &mut LendingPool<CollateralCoinType>,
        collateral_asset: u8,
        debt_cetus_pool: &CetusPool<DebtCoinType, TESTSUI>,
        collateral_cetus_pool: &CetusPool<CollateralCoinType, TESTSUI>,
        liquidate_user: address,
        liquidate_amount: u64,
        ctx: &mut TxContext
    ) {
        abort E_NOT_IMPLEMENTED
    }

    // === 查询函数 ===
    public fun get_reserves_count(storage: &LendingStorage): u8 {
        abort E_NOT_IMPLEMENTED
    }

    public fun get_user_assets(
        storage: &LendingStorage,
        user: address
    ): (vector<u8>, vector<u8>) {
        abort E_NOT_IMPLEMENTED
    }

    public fun get_user_balance(
        storage: &LendingStorage,
        asset: u8,
        user: address
    ): (u256, u256) {
        abort E_NOT_IMPLEMENTED
    }

    public fun calculate_health_factor(
        storage: &LendingStorage,
        user: address
    ): u64 {
        abort E_NOT_IMPLEMENTED
    }

    // === 内部函数 ===

    fun update_interest_rate<CoinType>(
        pool: &mut LendingPool<CoinType>,
        clock: &Clock
    ) {
        abort E_NOT_IMPLEMENTED
    }

    fun get_price_from_cetus_pool<CoinType>(
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        a2b: bool
    ): u64 {
        abort E_NOT_IMPLEMENTED
    }

    // 初始化函数
    public fun init_lending_storage(ctx: &mut TxContext) {
        let lending_storage = LendingStorage {
            id: object::new(ctx),
            supported_assets: vector::empty(),
            user_positions: table::new(ctx)
        };
        transfer::share_object(lending_storage);
    }

    // 添加新的支持资产
    public fun add_supported_asset(
        storage: &mut LendingStorage,
        asset_type: u8,
        ltv: u64,
        liquidation_threshold: u64,
    ) {
        let asset_info = AssetInfo {
            asset_type,
            ltv,
            liquidation_threshold,
        };
        vector::push_back(
            &mut storage.supported_assets,
            asset_info
        );
    }
}
