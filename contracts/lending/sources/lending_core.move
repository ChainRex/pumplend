module lending::lending_core {
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
    use std::string::String;
    use std::type_name::{Self, TypeName};
    use sui::clock;
    use legato_math::fixed_point64::{Self, FixedPoint64};
    use legato_math::math_fixed64;

    // === 错误码 ===
    const ENotImplement: u64 = 0;
    const EInsufficientBalance: u64 = 1001;
    const EInsufficientPoolBalance: u64 = 1002;
    const EExceedBorrowLimit: u64 = 1003;
    const EHealthFactorTooLow: u64 = 1004;

    // === 常量 ===
    // LTV
    const SUI_LTV: u64 = 60; // 60%
    const TOKEN_LTV: u64 = 20; // 20%

    // 清算阈值
    const SUI_LIQUIDATION_THRESHOLD: u64 = 85; // 85%
    const TOKEN_LIQUIDATION_THRESHOLD: u64 = 70; // 70%

    // 储备金率
    const RESERVE_FACTOR: u128 = 10; // 10%

    // 清算奖励
    const LIQUIDATION_BONUS: u64 = 10; // 10%

    const DECIMAL: u128 = 1_000_000_000;

    // 利率相关常量
    const YEAR_MS: u128 = 31_536_000_000; // 一年毫秒数
    // 利率区段参数
    const U_OPTIMAL: u128 = 5000;  // 50.00% - 最优利用率
    // 不同区段的利率(年化)
    const R_BASE: u128 = 0;      // 0.00% - 基础利率
    const R_SLOPE1: u128 = 2000;    // 20.00% - 第一阶段斜率
    const R_SLOPE2: u128 = 50000;  // 500.00% - 第二阶段最高利率

    // === 结构体 ===
    public struct LendingPool<phantom CoinType> has key {
        id: UID,
        // 储备金
        reserves: Balance<CoinType>,
        // 存款总额 
        total_supplies: u64,
        // 借款总额 
        total_borrows: u64,
        // 借款累计利率
        borrow_index: u64,
        // 存款累计利率
        supply_index: u64,
        // 借款年化利率
        borrow_rate: u128,
        // 存款年化利率
        supply_rate: u128,
        // 最后更新时间
        last_update_time: u64,
    }

    public struct UserPosition has key, store {
        id: UID,
        // 用户地址
        user: address,
        // 存款金额 (asset_type => amount)
        supplies: Table<TypeName, u64>,
        // 借款金额 (asset_type => amount)
        borrows: Table<TypeName, u64>,
        // 存储用户借款时的borrowIndex快照信息
        borrow_index_snapshots: Table<TypeName, u64>,
        // 存储用户存款时的supplyIndex快照信息
        supply_index_snapshots: Table<TypeName, u64>,
    }

    public struct AssetInfo has store, copy {
        type_name: TypeName,
        ltv: u64,
        liquidation_threshold: u64,
    }

    public struct LendingStorage has key {
        id: UID,
        // 支持的资产列表
        supported_assets: vector<AssetInfo>,
        // 价格 (asset_type => price) sui/token
        price: Table<TypeName, u128>,
        // 用户仓位 (user => UserPosition)
        user_positions: Table<address, UserPosition>,
    }

    // === 事件 ===
    public struct SupplyEvent has copy, drop {
        user: address,
        type_name: TypeName,
        amount: u64
    }

    public struct WithdrawEvent has copy, drop {
        user: address,
        type_name: TypeName,
        amount: u64
    }

    public struct BorrowEvent has copy, drop {
        user: address,
        type_name: TypeName,
        amount: u64
    }

    public struct RepayEvent has copy, drop {
        user: address,
        type_name: TypeName,
        amount: u64
    }

    public struct LiquidationEvent has copy, drop {
        liquidator: address,
        user: address,
        debt_asset_type: TypeName,
        collateral_asset_type: TypeName,
        debt_amount: u64,
        collateral_amount: u64
    }

    public struct CalculateHealthFactorEvent has copy, drop {
        user: address,
        health_factor: u64
    }

    public struct CalculateMaxBorrowValueEvent has copy, drop {
        user: address,
        max_borrow_value: u128
    }

    public struct GetUserPositionEvent has copy, drop {
        user: address,
        assets: vector<TypeName>,
        supplies: vector<u64>,
        borrows: vector<u64>,
        borrow_index_snapshots: vector<u64>,
        supply_index_snapshots: vector<u64>,
    }

    // === init ===

    fun init(ctx: &mut TxContext) {
        let lending_storage = LendingStorage {
            id: object::new(ctx),
            supported_assets: vector::empty(),
            user_positions: table::new(ctx),
            price: table::new(ctx)
        };
        transfer::share_object(lending_storage);
    }

    public entry fun add_testsui_asset(
        storage: &mut LendingStorage,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let coin_type = type_name::get<TESTSUI>();

        let asset_info = AssetInfo {
            type_name: coin_type,
            ltv: SUI_LTV,
            liquidation_threshold: SUI_LIQUIDATION_THRESHOLD,
        };
        vector::push_back(
            &mut storage.supported_assets,
            asset_info
        );
        table::add(
            &mut storage.price,
            coin_type,
            DECIMAL
        );
        let pool = LendingPool<TESTSUI> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<TESTSUI>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
        };
        transfer::share_object(pool);
    }

    // 添加新的支持资产
    public entry fun add_token_asset_a<CoinType>(
        storage: &mut LendingStorage,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let coin_type = type_name::get<CoinType>();

        let asset_info = AssetInfo {
            type_name: coin_type,
            ltv: TOKEN_LTV,
            liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD,
        };
        vector::push_back(
            &mut storage.supported_assets,
            asset_info
        );
        let (balance_a, balance_b) = cetus_pool.balances();
        // sui/token
        let price = (
            (balance::value(balance_b) as u128) * DECIMAL
        ) / (balance::value(balance_a) as u128);
        table::add(&mut storage.price, coin_type, price);
        let pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
        };
        transfer::share_object(pool);
    }

    public entry fun add_token_asset_b<CoinType>(
        storage: &mut LendingStorage,
        cetus_pool: &CetusPool<TESTSUI, CoinType>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let coin_type = type_name::get<CoinType>();

        let asset_info = AssetInfo {
            type_name: coin_type,
            ltv: TOKEN_LTV,
            liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD,
        };
        vector::push_back(
            &mut storage.supported_assets,
            asset_info
        );
        let (balance_a, balance_b) = cetus_pool.balances();
        let price = (
            (balance::value(balance_a) as u128) * DECIMAL
        ) / (balance::value(balance_b) as u128);
        table::add(&mut storage.price, coin_type, price);
        let pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
        };
        transfer::share_object(pool);
    }

    // === 公共函数 ===
    public entry fun supply_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        supply_coin: &mut Coin<TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<TESTSUI>();
        let user = tx_context::sender(ctx);

        let supply_amount = coin::value(supply_coin);
        assert!(
            supply_amount >= amount,
            EInsufficientBalance
        );

        let split_coin = coin::split(supply_coin, amount, ctx);
        let supply_balance = coin::into_balance(split_coin);

        // 更新储备金和存款总额
        balance::join(&mut pool.reserves, supply_balance);
        pool.total_supplies = pool.total_supplies + amount;

        if (!table::contains(&storage.user_positions, user)) {
            let user_position = UserPosition {
                id: object::new(ctx),
                user,
                supplies: table::new(ctx),
                borrows: table::new(ctx),
                borrow_index_snapshots: table::new(ctx),
                supply_index_snapshots: table::new(ctx),
            };
            table::add(
                &mut storage.user_positions,
                user,
                user_position
            );
        };

        let user_position = table::borrow_mut(&mut storage.user_positions, user);

        if (!table::contains(&user_position.supplies, coin_type)) {
            table::add(
                &mut user_position.supplies,
                coin_type,
                amount
            );
            // 记录存款时的累积利率
            table::add(
                &mut user_position.supply_index_snapshots,
                coin_type,
                pool.supply_index
            );
        } else {
            // 如果已有存款，需要先结算之前的利息
            let actual_supply = calculate_user_actual_supply_amount(pool, user_position, coin_type);
            let supply_value = table::borrow_mut(
                &mut user_position.supplies,
                coin_type
            );
            *supply_value = actual_supply + amount;
            // 更新累积利率快照
            let index_snapshot = table::borrow_mut(
                &mut user_position.supply_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.supply_index;
        };
        update_interest_rate(pool, clock);
        event::emit(
            SupplyEvent {
                user,
                type_name: coin_type,
                amount
            }
        );
    }

    public entry fun withdraw_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<TESTSUI>();
        // 获取用户地址
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        let user_position = table::borrow_mut(&mut storage.user_positions, user);

        // 检查用户是否有足够的存款
        assert!(
            table::contains(&user_position.supplies, coin_type),
            EInsufficientBalance
        );

        // 计算实际存款金额（包含利息）
        let actual_supply = calculate_user_actual_supply_amount(pool, user_position, coin_type);
        
        // 检查提款金额是否超过实际存款金额
        assert!(
            actual_supply >= amount,
            EInsufficientBalance
        );

        // 更新用户存款记录
        let remaining_supply = actual_supply - amount;
        if (remaining_supply == 0) {
            // 如果全部提取，删除存款记录和累积利率快照
            table::remove(&mut user_position.supplies, coin_type);
            table::remove(&mut user_position.supply_index_snapshots, coin_type);
        } else {
            // 部分提取，更新存款金额和累积利率快照
            let supply_value = table::borrow_mut(
                &mut user_position.supplies,
                coin_type
            );
            *supply_value = remaining_supply;
            let index_snapshot = table::borrow_mut(
                &mut user_position.supply_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.supply_index;
        };

        // 更新存款总额
        pool.total_supplies = pool.total_supplies - amount;

        assert!(
            balance::value(&pool.reserves) >= amount,
            EInsufficientBalance
        );

        // 检查健康因子是否满足要求 (大于1)
        let health_factor = calculate_health_factor(storage, user);
        assert!(
            health_factor > 100,
            EHealthFactorTooLow
        );

        // 从储备金中提取代币
        let withdraw_balance = balance::split(&mut pool.reserves, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);

        // 转账给用户
        transfer::public_transfer(withdraw_coin, user);
        update_interest_rate(pool, clock);
        // 发出提现事件
        event::emit(
            WithdrawEvent {
                user,
                type_name: coin_type,
                amount
            }
        );
    }

    public entry fun borrow_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<TESTSUI>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        // 检查资金池余额是否足够
        assert!(
            balance::value(&pool.reserves) >= amount,
            EInsufficientPoolBalance
        );

        // 检查借款金额是否超过最大可借额度
        let borrow_value = (amount as u128) * DECIMAL; // 因为 TESTSUI 价格为 1
        let max_borrow_value = calculate_max_borrow_value(storage, user);

        // 计算当前已借金额
        let user_position = table::borrow(&storage.user_positions, user);
        let mut current_borrows: u128 = 0;
        if (table::contains(&user_position.borrows, coin_type)) {
            current_borrows = (
                *table::borrow(&user_position.borrows, coin_type) as u128
            ) * DECIMAL;
        };

        assert!(
            current_borrows + borrow_value <= max_borrow_value,
            EExceedBorrowLimit
        );

        let user_position = table::borrow_mut(&mut storage.user_positions, user);

        // 更新借款记录
        if (!table::contains(&user_position.borrows, coin_type)) {
            table::add(
                &mut user_position.borrows,
                coin_type,
                amount
            );
            // 记录借款时的累积利率
            table::add(
                &mut user_position.borrow_index_snapshots,
                coin_type,
                pool.borrow_index
            );
        } else {
            // 如果已有借款，需要先结算之前的利息
            let actual_borrow = calculate_user_actual_borrow_amount(pool, user_position, coin_type);
            let borrow_value = table::borrow_mut(
                &mut user_position.borrows,
                coin_type
            );
            *borrow_value = actual_borrow + amount;
            // 更新累积利率快照
            let index_snapshot = table::borrow_mut(
                &mut user_position.borrow_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.borrow_index;
        };

        // 检查健康因子是否满足要求 (大于1)
        let health_factor = calculate_health_factor(storage, user);
        assert!(
            health_factor > 100,
            EHealthFactorTooLow
        );

        // 更新借款总额
        pool.total_borrows = pool.total_borrows + amount;

        // 从储备金中提取代币
        let borrow_balance = balance::split(&mut pool.reserves, amount);
        let borrow_coin = coin::from_balance(borrow_balance, ctx);

        // 转账给用户
        transfer::public_transfer(borrow_coin, user);
        update_interest_rate(pool, clock);
        // 发出借款事件
        event::emit(
            BorrowEvent {
                user,
                type_name: coin_type,
                amount
            }
        );
    }

    public entry fun repay_testsui(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<TESTSUI>,
        repay_coin: &mut Coin<TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<TESTSUI>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        let user_position = table::borrow(&storage.user_positions, user);

        // 检查用户是否有借款
        assert!(
            table::contains(&user_position.borrows, coin_type),
            EInsufficientBalance
        );

        // 检查还款金额
        let borrow_amount = *table::borrow(&user_position.borrows, coin_type);
        let repay_amount = coin::value(repay_coin);
        assert!(
            repay_amount >= amount,
            EInsufficientBalance
        );

        // 计算实际借款金额（包含利息）
        let actual_borrow = calculate_user_actual_borrow_amount(pool, user_position, coin_type);
        
        // 如果还款金额大于实际借款金额（包含利息），则只还实际借款金额
        let actual_repay_amount = if (amount > actual_borrow) { actual_borrow } else { amount };
        
        // 拆分代币
        let split_coin = coin::split(repay_coin, actual_repay_amount, ctx);

        // 更新用户借款记录
        let user_position = table::borrow_mut(&mut storage.user_positions, user);
        if (actual_repay_amount == actual_borrow) {
            // 如果全部还清，删除借款记录和累积利率快照
            table::remove(&mut user_position.borrows, coin_type);
            table::remove(&mut user_position.borrow_index_snapshots, coin_type);
        } else {
            // 部分还款，更新借款金额和累积利率快照
            let remaining_borrow = actual_borrow - actual_repay_amount;
            let borrow_value = table::borrow_mut(
                &mut user_position.borrows,
                coin_type
            );
            *borrow_value = remaining_borrow;
            let index_snapshot = table::borrow_mut(
                &mut user_position.borrow_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.borrow_index;
        };

        // 更新借款总额
        pool.total_borrows = pool.total_borrows - actual_repay_amount;

        // 将还款代币存入储备金
        let repay_balance = coin::into_balance(split_coin);
        balance::join(&mut pool.reserves, repay_balance);
        update_interest_rate(pool, clock);
        // 发出还款事件
        event::emit(
            RepayEvent {
                user,
                type_name: coin_type,
                amount: actual_repay_amount
            }
        );
    }

    public entry fun supply_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        supply_coin: &mut Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<CoinType>();

        // 获取用户地址
        let user = tx_context::sender(ctx);

        // 检查存款金额
        let supply_amount = coin::value(supply_coin);
        assert!(
            supply_amount >= amount,
            EInsufficientBalance
        );

        // 拆分代币
        let split_coin = coin::split(supply_coin, amount, ctx);

        // 将代币存入资金池
        let supply_balance = coin::into_balance(split_coin);
        balance::join(&mut pool.reserves, supply_balance);

        // 更新用户仓位
        if (!table::contains(&storage.user_positions, user)) {
            let user_position = UserPosition {
                id: object::new(ctx),
                user,
                supplies: table::new(ctx),
                borrows: table::new(ctx),
                borrow_index_snapshots: table::new(ctx),
                supply_index_snapshots: table::new(ctx),
            };
            table::add(
                &mut storage.user_positions,
                user,
                user_position
            );
        };

        let user_position = table::borrow_mut(&mut storage.user_positions, user);

        if (!table::contains(&user_position.supplies, coin_type)) {
            table::add(
                &mut user_position.supplies,
                coin_type,
                amount
            );
            // 记录存款时的累积利率
            table::add(
                &mut user_position.supply_index_snapshots,
                coin_type,
                pool.supply_index
            );
        } else {
            // 如果已有存款，需要先结算之前的利息
            let actual_supply = calculate_user_actual_supply_amount(pool, user_position, coin_type);
            let supply_value = table::borrow_mut(
                &mut user_position.supplies,
                coin_type
            );
            *supply_value = actual_supply + amount;
            // 更新累积利率快照
            let index_snapshot = table::borrow_mut(
                &mut user_position.supply_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.supply_index;
        };

        // 更新存款总额
        pool.total_supplies = pool.total_supplies + amount;
        update_interest_rate(pool, clock);
        // 发出存款事件
        event::emit(
            SupplyEvent {
                user,
                type_name: coin_type,
                amount
            }
        );
    }

    public entry fun withdraw_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<CoinType>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        let user_position = table::borrow_mut(&mut storage.user_positions, user);

        // 检查用户是否有足够的存款
        assert!(
            table::contains(&user_position.supplies, coin_type),
            EInsufficientBalance
        );

        // 计算实际存款金额（包含利息）
        let actual_supply = calculate_user_actual_supply_amount(pool, user_position, coin_type);
        
        // 检查提款金额是否超过实际存款金额
        assert!(
            actual_supply >= amount,
            EInsufficientBalance
        );

        // 更新用户存款记录
        let remaining_supply = actual_supply - amount;
        if (remaining_supply == 0) {
            // 如果全部提取，删除存款记录和累积利率快照
            table::remove(&mut user_position.supplies, coin_type);
            table::remove(&mut user_position.supply_index_snapshots, coin_type);
        } else {
            // 部分提取，更新存款金额和累积利率快照
            let supply_value = table::borrow_mut(
                &mut user_position.supplies,
                coin_type
            );
            *supply_value = remaining_supply;
            let index_snapshot = table::borrow_mut(
                &mut user_position.supply_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.supply_index;
        };

        // 更新存款总额
        pool.total_supplies = pool.total_supplies - amount;

        assert!(
            balance::value(&pool.reserves) >= amount,
            EInsufficientBalance
        );

        // 检查健康因子是否满足要求 (大于1)
        let health_factor = calculate_health_factor(storage, user);
        assert!(
            health_factor > 100,
            EHealthFactorTooLow
        );

        // 从储备金中提取代币
        let withdraw_balance = balance::split(&mut pool.reserves, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);

        // 转账给用户
        transfer::public_transfer(withdraw_coin, user);
        update_interest_rate(pool, clock);
        // 发出提现事件
        event::emit(
            WithdrawEvent {
                user,
                type_name: coin_type,
                amount
            }
        );
    }

    public entry fun borrow_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<CoinType>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        // 检查资金池余额是否足够
        assert!(
            balance::value(&pool.reserves) >= amount,
            EInsufficientPoolBalance
        );

        // 检查借款金额是否超过最大可借额度
        let token_price = *table::borrow(&storage.price, coin_type);
        let borrow_value = ((amount as u128) * token_price) / DECIMAL; // 转换为 SUI 价值
        let max_borrow_value = calculate_max_borrow_value(storage, user);

        // 计算当前已借金额
        let user_position = table::borrow(&storage.user_positions, user);
        let mut current_borrows: u128 = 0;
        if (table::contains(&user_position.borrows, coin_type)) {
            current_borrows = (
                *table::borrow(&user_position.borrows, coin_type) as u128
            ) * token_price / DECIMAL;
        };

        assert!(
            current_borrows + borrow_value <= max_borrow_value,
            EExceedBorrowLimit
        );

        let user_position = table::borrow_mut(&mut storage.user_positions, user);

        // 更新借款记录
        if (!table::contains(&user_position.borrows, coin_type)) {
            table::add(
                &mut user_position.borrows,
                coin_type,
                amount
            );
            // 记录借款时的累积利率
            table::add(
                &mut user_position.borrow_index_snapshots,
                coin_type,
                pool.borrow_index
            );
        } else {
            // 如果已有借款，需要先结算之前的利息
            let actual_borrow = calculate_user_actual_borrow_amount(pool, user_position, coin_type);
            let borrow_value = table::borrow_mut(
                &mut user_position.borrows,
                coin_type
            );
            *borrow_value = actual_borrow + amount;
            // 更新累积利率快照
            let index_snapshot = table::borrow_mut(
                &mut user_position.borrow_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.borrow_index;
        };

        // 检查健康因子是否满足要求 (大于1)
        let health_factor = calculate_health_factor(storage, user);
        assert!(
            health_factor > 100,
            EHealthFactorTooLow
        );

        // 更新借款总额
        pool.total_borrows = pool.total_borrows + amount;

        // 从资金池借出代币
        let borrow_balance = balance::split(&mut pool.reserves, amount);
        let borrow_coin = coin::from_balance(borrow_balance, ctx);

        // 转账给用户
        transfer::public_transfer(borrow_coin, user);
        update_interest_rate(pool, clock);
        // 发出借款事件
        event::emit(
            BorrowEvent {
                user,
                type_name: coin_type,
                amount
            }
        );
    }

    public entry fun repay_token<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        repay_coin: &mut Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        let coin_type = type_name::get<CoinType>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        let user_position = table::borrow(&storage.user_positions, user);

        // 检查用户是否有借款
        assert!(
            table::contains(&user_position.borrows, coin_type),
            EInsufficientBalance
        );

        // 检查还款金额
        let borrow_amount = *table::borrow(&user_position.borrows, coin_type);
        let repay_amount = coin::value(repay_coin);
        assert!(
            repay_amount >= amount,
            EInsufficientBalance
        );

        // 计算实际借款金额（包含利息）
        let actual_borrow = calculate_user_actual_borrow_amount(pool, user_position, coin_type);
        
        // 如果还款金额大于实际借款金额（包含利息），则只还实际借款金额
        let actual_repay_amount = if (amount > actual_borrow) { actual_borrow } else { amount };
        
        // 拆分代币
        let split_coin = coin::split(repay_coin, actual_repay_amount, ctx);

        // 更新用户借款记录
        let user_position = table::borrow_mut(&mut storage.user_positions, user);
        if (actual_repay_amount == actual_borrow) {
            // 如果全部还清，删除借款记录和累积利率快照
            table::remove(&mut user_position.borrows, coin_type);
            table::remove(&mut user_position.borrow_index_snapshots, coin_type);
        } else {
            // 部分还款，更新借款金额和累积利率快照
            let remaining_borrow = actual_borrow - actual_repay_amount;
            let borrow_value = table::borrow_mut(
                &mut user_position.borrows,
                coin_type
            );
            *borrow_value = remaining_borrow;
            let index_snapshot = table::borrow_mut(
                &mut user_position.borrow_index_snapshots,
                coin_type
            );
            *index_snapshot = pool.borrow_index;
        };

        // 更新借款总额
        pool.total_borrows = pool.total_borrows - actual_repay_amount;

        // 将还款代币存入资金池
        let repay_balance = coin::into_balance(split_coin);
        balance::join(&mut pool.reserves, repay_balance);
        update_interest_rate(pool, clock);
        // 发出还款事件
        event::emit(
            RepayEvent {
                user,
                type_name: coin_type,
                amount: actual_repay_amount
            }
        );
    }

    // 清算
    // public entry fun liquidate<DebtCoinType, CollateralCoinType>(
    //     clock: &Clock,
    //     storage: &mut LendingStorage,
    //     debt_pool: &mut LendingPool<DebtCoinType>,
    //     debt_coin: Coin<DebtCoinType>,
    //     collateral_pool: &mut LendingPool<CollateralCoinType>,
    //     cetus_pool: &CetusPool<CollateralCoinType, DebtCoinType>,
    //     liquidate_user: address,
    //     liquidate_amount: u64,
    //     ctx: &mut TxContext
    // ) {
    //     abort ENotImplement
    // }

    // === 查询函数 ===
    public fun get_reserves_count(storage: &LendingStorage): u8 {
        abort ENotImplement
    }

    public fun get_user_assets(
        storage: &LendingStorage,
        user: address
    ): (vector<u8>, vector<u8>) {
        abort ENotImplement
    }

    public fun get_user_balance<CoinType>(
        storage: &LendingStorage,
        user: address
    ): (u256, u256) {
        abort ENotImplement
    }


    public entry fun get_user_position(
        storage: &LendingStorage,
        user: address
    ) {
        let user_position = table::borrow(&storage.user_positions, user);
        let mut assets: vector<TypeName> = vector::empty();
        let mut supplies: vector<u64> = vector::empty();
        let mut borrows: vector<u64> = vector::empty();
        let mut borrow_index_snapshots: vector<u64> = vector::empty();
        let mut supply_index_snapshots: vector<u64> = vector::empty();

        let mut i = 0;
        let assets_len = vector::length(&storage.supported_assets);
        while (i < assets_len) {
            let asset_info = vector::borrow(&storage.supported_assets, i);
            if (table::contains(
                    &user_position.supplies,
                    asset_info.type_name
                )) {
                vector::push_back(&mut assets, asset_info.type_name);
                vector::push_back(&mut supplies, *table::borrow(
                    &user_position.supplies,
                    asset_info.type_name
                ));
                vector::push_back(&mut supply_index_snapshots, *table::borrow(
                    &user_position.supply_index_snapshots,
                    asset_info.type_name
                ));
            };
            if (table::contains(
                    &user_position.borrows,
                    asset_info.type_name
                )) {
                vector::push_back(&mut assets, asset_info.type_name);
                vector::push_back(&mut borrows, *table::borrow(
                    &user_position.borrows,
                    asset_info.type_name
                ));
            };
            i = i + 1;
        };
        event::emit(
            GetUserPositionEvent {
                user,
                assets,
                supplies,
                borrows,
                borrow_index_snapshots,
                supply_index_snapshots,
            }
        );
    }

    // 计算健康因子
    public entry fun calculate_health_factor(
        storage: &LendingStorage,
        user: address
    ): u64 {
        // 检查用户是否有仓位
        if (!table::contains(&storage.user_positions, user)) {
            return 0
        };

        let user_position = table::borrow(&storage.user_positions, user);
        let mut total_collateral_in_threshold: u128 = 0;
        let mut total_borrows_in_sui: u128 = 0;

        // 计算所有抵押物价值
        let mut i = 0;
        let assets_len = vector::length(&storage.supported_assets);
        while (i < assets_len) {
            let asset_info = vector::borrow(&storage.supported_assets, i);
            if (table::contains(
                    &user_position.supplies,
                    asset_info.type_name
                )) {
                let supply_amount = *table::borrow(
                    &user_position.supplies,
                    asset_info.type_name
                );
                let price = *table::borrow(
                    &storage.price,
                    asset_info.type_name
                );

                // 将抵押物价值转换为 SUI (使用清算阈值)
                let value_in_threshold = (
                    (supply_amount as u128) * price * (
                        asset_info.liquidation_threshold as u128
                    )
                ) / (100 * DECIMAL);
                total_collateral_in_threshold = total_collateral_in_threshold + value_in_threshold;
            };
            i = i + 1;
        };

        // 计算所有借款价值
        let mut i = 0;
        while (i < assets_len) {
            let asset_info = vector::borrow(&storage.supported_assets, i);
            if (table::contains(
                    &user_position.borrows,
                    asset_info.type_name
                )) {
                let borrow_amount = *table::borrow(
                    &user_position.borrows,
                    asset_info.type_name
                );
                let price = *table::borrow(
                    &storage.price,
                    asset_info.type_name
                );

                // 将借款价值转换为 SUI
                let value_in_sui = ((borrow_amount as u128) * price) / DECIMAL;
                total_borrows_in_sui = total_borrows_in_sui + value_in_sui;
            };
            i = i + 1;
        };

        // 如果没有借款,返回最大健康因子
        if (total_borrows_in_sui == 0) {
            return 1000000
        };
        event::emit(
            CalculateHealthFactorEvent {
                user,
                health_factor: ((total_collateral_in_threshold * 100) / total_borrows_in_sui) as u64
            }
        );

        // 计算健康因子 (扩大100倍以保持精度)
        (
            (total_collateral_in_threshold * 100) / total_borrows_in_sui as u64
        )
    }

    // 计算最大可借款价值的函数
    public entry fun calculate_max_borrow_value(
        storage: &LendingStorage,
        user: address
    ): u128 {
        // 检查用户是否有仓位
        if (!table::contains(&storage.user_positions, user)) {
            return 0
        };

        let user_position = table::borrow(&storage.user_positions, user);
        let mut total_collateral_in_ltv: u128 = 0;

        // 计算所有抵押物价值
        let mut i = 0;
        let assets_len = vector::length(&storage.supported_assets);
        while (i < assets_len) {
            let asset_info = vector::borrow(&storage.supported_assets, i);
            if (table::contains(
                    &user_position.supplies,
                    asset_info.type_name
                )) {
                let supply_amount = *table::borrow(
                    &user_position.supplies,
                    asset_info.type_name
                );
                let price = *table::borrow(
                    &storage.price,
                    asset_info.type_name
                );

                // 将抵押物价值转换为 SUI (使用 LTV)
                let value_in_ltv = (
                    (supply_amount as u128) * price * (asset_info.ltv as u128)
                ) / 100;
                total_collateral_in_ltv = total_collateral_in_ltv + value_in_ltv;
            };
            i = i + 1;
        };
        event::emit(
            CalculateMaxBorrowValueEvent {
                user,
                max_borrow_value: total_collateral_in_ltv
            }
        );
        total_collateral_in_ltv
    }

    

    // === 内部函数 ===

    // 利率计算相关函数
    fun compute_borrow_rate<CoinType>(pool: &LendingPool<CoinType>) : u128 {
        let total_supplies = pool.total_supplies;
        let total_borrows = pool.total_borrows;
        
        // 当没有存款时返回基础利率
        if (total_supplies == 0) {
            return R_BASE
        };

        // 计算利用率 (放大到DECIMAL)
        let utilization_rate = ((total_borrows as u128) * DECIMAL) / (total_supplies as u128);
        
        // 当没有借款时返回基础利率
        if (utilization_rate == 0) {
            return R_BASE
        };

        // 将利用率转换为百分比 (0-10000)
        let utilization_rate_percent = utilization_rate * 10000 / DECIMAL;

        if (utilization_rate_percent <= U_OPTIMAL) {
            // 第一阶段：线性增长
            // rate = base_rate + (r_slope1 * u) / u_optimal
            R_BASE + (R_SLOPE1 * utilization_rate_percent) / U_OPTIMAL
        } else {
            // 第二阶段：超额利用率部分使用更陡的斜率
            let base_rate = R_BASE + R_SLOPE1; // 在最优利用率点的利率
            let excess_utilization = utilization_rate_percent - U_OPTIMAL;
            let max_excess = 10000 - U_OPTIMAL;
            
            // 对超额部分使用更高的斜率
            let excess_rate = (R_SLOPE2 * excess_utilization) / max_excess;
            
            base_rate + excess_rate
        }
    }

    // 计算存款年化利率
    fun compute_supply_rate<CoinType>(pool: &LendingPool<CoinType>) : u128 {
        // 计算借款利率
        let borrow_rate = compute_borrow_rate(pool);
        
        // 存款利率 = 借款利率 * (1 - 储备金率)
        ((borrow_rate * (10000 - RESERVE_FACTOR * 100)) / 10000)
    }

    // 利息因子计算函数
    fun calc_borrow_rate(annual_rate_percentage: u128, time_delta: u64) : u128 {
        (annual_rate_percentage * (time_delta as u128) * DECIMAL) / (10000 * YEAR_MS)
    }

    // 利率更新函数
    fun update_interest_rate<CoinType>(
        pool: &mut LendingPool<CoinType>, 
        clock: &Clock
    ) {
        let current_time = clock::timestamp_ms(clock);

        let time_delta = current_time - pool.last_update_time;
        
        // 计算借款和存款年化利率
        let borrow_rate = compute_borrow_rate(pool);
        let supply_rate = compute_supply_rate(pool);
        
        // 计算这段时间的实际利率
        let actual_borrow_rate = calc_borrow_rate(borrow_rate, time_delta);
        let actual_supply_rate = calc_borrow_rate(supply_rate, time_delta);

        // 更新总借款金额
        let new_total_borrows = (
            (pool.total_borrows as u128) * (DECIMAL + actual_borrow_rate)
        ) / DECIMAL;
        pool.total_borrows = (new_total_borrows as u64);

        // 更新借款累积利率
        let old_borrow_index = pool.borrow_index as u128;
        let new_borrow_index = (old_borrow_index * (DECIMAL + actual_borrow_rate)) / DECIMAL;
        pool.borrow_index = (new_borrow_index as u64);

        // 更新存款累积利率
        let old_supply_index = pool.supply_index as u128;
        let new_supply_index = (old_supply_index * (DECIMAL + actual_supply_rate)) / DECIMAL;
        pool.supply_index = (new_supply_index as u64);

        // 更新年化利率
        pool.borrow_rate = borrow_rate;
        pool.supply_rate = supply_rate;
        
        // 更新最后计息时间
        pool.last_update_time = current_time;
    }

    // 计算用户实际借款金额（包含利息）
    fun calculate_user_actual_borrow_amount<CoinType>(
        pool: &LendingPool<CoinType>,
        user_position: &UserPosition,
        coin_type: TypeName
    ): u64 {
        if (!table::contains(&user_position.borrows, coin_type)) {
            return 0
        };

        let borrow_amount = *table::borrow(&user_position.borrows, coin_type);
        let user_borrow_index = *table::borrow(&user_position.borrow_index_snapshots, coin_type);
        
        // 计算实际借款金额：原始借款金额 * (当前累积利率 / 借款时的累积利率)
        let actual_amount = (
            (borrow_amount as u128) * (pool.borrow_index as u128)
        ) / (user_borrow_index as u128);
        
        (actual_amount as u64)
    }

    // 计算用户实际存款金额（包含利息）
    fun calculate_user_actual_supply_amount<CoinType>(
        pool: &LendingPool<CoinType>,
        user_position: &UserPosition,
        coin_type: TypeName
    ): u64 {
        if (!table::contains(&user_position.supplies, coin_type)) {
            return 0
        };

        let supply_amount = *table::borrow(&user_position.supplies, coin_type);
        let user_supply_index = *table::borrow(&user_position.supply_index_snapshots, coin_type);
        
        // 计算实际存款金额：原始存款金额 * (当前累积利率 / 存款时的累积利率)
        let actual_amount = (
            (supply_amount as u128) * (pool.supply_index as u128)
        ) / (user_supply_index as u128);
        
        (actual_amount as u64)
    }

}
