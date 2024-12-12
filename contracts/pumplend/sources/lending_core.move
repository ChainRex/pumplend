module pumplend::lending_core {
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::event;
    use cetus_clmm::pool::{Pool as CetusPool};
    use testsui::testsui::{ TESTSUI };
    use std::type_name::{Self, TypeName};
    use sui::clock;


    // === 错误码 ===
    const EInsufficientBalance: u64 = 1001;
    const EInsufficientPoolBalance: u64 = 1002;
    const EExceedBorrowLimit: u64 = 1003;
    const EHealthFactorTooLow: u64 = 1004;
    const ETokenPriceTooLow: u64 = 1005;

    // === 常量 ===
    // LTV
    const SUI_LTV: u64 = 60; // 60%
    const TOKEN_LTV: u64 = 20; // 20%

    // Token 债务乘数(用于降低杠杆)
    const TOKEN_DEBT_MULTIPLIER: u128 = 3; // 3倍

    // 清算阈值
    const SUI_LIQUIDATION_THRESHOLD: u64 = 85; // 85%
    const TOKEN_LIQUIDATION_THRESHOLD: u64 = 70; // 70%

    // 储备金率
    const RESERVE_FACTOR: u128 = 30; // 30%

    // 清算折扣
    const LIQUIDATION_DISCOUNT: u64 = 20; // 20% 折扣

    // 借款利率折扣
    const BORROW_INTEREST_RATE_DISCOUNT_INITIAL: u128 = 2500; // 25%

    // 存款利率加成
    const SUPPLY_INTEREST_RATE_BONUS_INITIAL: u128 = 2500; // 25%

    const DECIMAL: u128 = 1_000_000_000;

    // 利率相关常量
    const YEAR_MS: u128 = 31_536_000_000; // 一年毫秒数
    // 利率区段参数
    const U_OPTIMAL: u128 = 5000;  // 50.00% - 最优利用率
    // 不同区段的利率(年化)
    const R_BASE: u128 = 0;      // 0.00% - 基础利率
    const R_SLOPE1: u128 = 2000;    // 20.00% - 第一阶段斜率
    const R_SLOPE2: u128 = 50000;  // 500.00% - 第二阶段最高利率

    // 最低利率激励阈值常量
    const MIN_INTEREST_RATE_BONUS: u128 = 50; // 0.5%

    // 最低可借出价格
    const MIN_BORROW_PRICE: u128 = 12_500_000; // 0.0125 TESTSUI/token

    // === 结构体 ===
    public struct LendingPool<phantom CoinType> has key {
        id: UID,
        // 储备金
        reserves: Balance<CoinType>,
        // 捐赠储备金 - 储存已收到但未分配的捐赠代币
        donation_reserves: Balance<CoinType>,
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
        // 存款额外利率加成
        extra_supply_interest_rate_bonus: u128,
        // 借款利率折扣
        borrow_interest_rate_discount: u128,
        // 捐赠资金可用于借出的最大比例
        max_donation_to_lend_ratio: u128,
        // 历史捐赠总额
        total_donations: u64,
        // 已借出的捐赠资金总额
        donations_lent_out: u64,

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

        // 价格更新时间 (asset_type => timestamp)
        price_update_time: Table<TypeName, u64>,

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
        borrow_value: u128,
        supply_value: u128
    }

    public struct CalculateRemainingBorrowValueEvent has copy, drop {
        user: address,
        remaining_borrow_value: u128
    }

    public struct AddAssetEvent has copy, drop {
        type_name: TypeName,
        ltv: u64,
        liquidation_threshold: u64
    }

    public struct DonateEvent has copy, drop {
        type_name: TypeName,
        amount: u64
    }



    // === init ===

    fun init(ctx: &mut TxContext) {
        let lending_storage = LendingStorage {
            id: object::new(ctx),
            supported_assets: vector::empty(),
            user_positions: table::new(ctx),
            price: table::new(ctx),
            price_update_time: table::new(ctx),
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
        table::add(
            &mut storage.price_update_time,
            coin_type,
            clock::timestamp_ms(clock)
        );
        let pool = LendingPool<TESTSUI> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<TESTSUI>(),
            donation_reserves: balance::zero<TESTSUI>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
            extra_supply_interest_rate_bonus: SUPPLY_INTEREST_RATE_BONUS_INITIAL,
            borrow_interest_rate_discount: BORROW_INTEREST_RATE_DISCOUNT_INITIAL,
            max_donation_to_lend_ratio: 5000,
            total_donations: 0,
            donations_lent_out: 0,

        };
        // 发出添加资产事件
        event::emit(
            AddAssetEvent {
                type_name: coin_type,
                ltv: SUI_LTV,
                liquidation_threshold: SUI_LIQUIDATION_THRESHOLD
            }
        );
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
        table::add(
            &mut storage.price_update_time,
            coin_type,
            clock::timestamp_ms(clock)
        );
        let pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            donation_reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
            extra_supply_interest_rate_bonus: SUPPLY_INTEREST_RATE_BONUS_INITIAL,
            borrow_interest_rate_discount: BORROW_INTEREST_RATE_DISCOUNT_INITIAL,
            max_donation_to_lend_ratio: 5000,
            total_donations: 0,
            donations_lent_out: 0,
        };
        // 发出添加资产事件
        event::emit(
            AddAssetEvent {
                type_name: coin_type,
                ltv: TOKEN_LTV,
                liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD
            }
        );
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
        table::add(
            &mut storage.price_update_time,
            coin_type,
            clock::timestamp_ms(clock)
        );
        let pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            donation_reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
            extra_supply_interest_rate_bonus: SUPPLY_INTEREST_RATE_BONUS_INITIAL,
            borrow_interest_rate_discount: BORROW_INTEREST_RATE_DISCOUNT_INITIAL,
            max_donation_to_lend_ratio: 5000,
            total_donations: 0,
            donations_lent_out: 0,
        };
        // 发出添加资产事件
        event::emit(
            AddAssetEvent {
                type_name: coin_type,
                ltv: TOKEN_LTV,
                liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD
            }
        );
        transfer::share_object(pool);
    }

    // 捐赠
    public entry fun donate<CoinType>(
        pool: &mut LendingPool<CoinType>,
        donate_coin: Coin<CoinType>,
    ) {
        // 获取捐赠数量
        let amount = coin::value(&donate_coin);
        
        // 获取资产类型
        let coin_type = type_name::get<CoinType>();

        // 将代币转换为 Balance 并加入捐赠储备金
        let donate_balance = coin::into_balance(donate_coin);
        balance::join(&mut pool.donation_reserves, donate_balance);

        // 更新历史捐赠总额
        pool.total_donations = pool.total_donations + amount;

        // 重新调整利率激励
        adjust_donation_based_rates(pool);

        // 发出捐赠事件
        event::emit(
            DonateEvent {
                type_name: coin_type,
                amount
            }
        );
    }

    public(package)fun add_token_asset_with_donation_and_price<CoinType>(
        storage: &mut LendingStorage,
        price: u128,
        donate_coin: Coin<CoinType>,
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

        table::add(&mut storage.price, coin_type, price);
        table::add(
            &mut storage.price_update_time,
            coin_type,
            clock::timestamp_ms(clock)
        );
        let mut pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            donation_reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
            extra_supply_interest_rate_bonus: SUPPLY_INTEREST_RATE_BONUS_INITIAL,
            borrow_interest_rate_discount: BORROW_INTEREST_RATE_DISCOUNT_INITIAL,
            max_donation_to_lend_ratio: 5000,
            total_donations: 0,
            donations_lent_out: 0,
        };
        donate(&mut pool, donate_coin);
        // 发出添加资产事件
        event::emit(
            AddAssetEvent {
                type_name: coin_type,
                ltv: TOKEN_LTV,
                liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD
            }
        );
        transfer::share_object(pool);
    }

    public entry fun add_token_asset_a_with_donation<CoinType>(
        storage: &mut LendingStorage,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        donate_coin: Coin<CoinType>,
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
        table::add(
            &mut storage.price_update_time,
            coin_type,
            clock::timestamp_ms(clock)
        );
        let mut pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            donation_reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
            extra_supply_interest_rate_bonus: SUPPLY_INTEREST_RATE_BONUS_INITIAL,
            borrow_interest_rate_discount: BORROW_INTEREST_RATE_DISCOUNT_INITIAL,
            max_donation_to_lend_ratio: 5000,
            total_donations: 0,
            donations_lent_out: 0,
        };
        donate(&mut pool, donate_coin);
        // 发出添加资产事件
        event::emit(
            AddAssetEvent {
                type_name: coin_type,
                ltv: TOKEN_LTV,
                liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD
            }
        );
        transfer::share_object(pool);
    }

    public entry fun add_token_asset_b_with_donation<CoinType>(
        storage: &mut LendingStorage,
        cetus_pool: &CetusPool<TESTSUI, CoinType>,
        donate_coin: Coin<CoinType>,
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
        table::add(
            &mut storage.price_update_time,
            coin_type,
            clock::timestamp_ms(clock)
        );
        let mut pool = LendingPool<CoinType> {
            id: object::new(ctx),
            total_supplies: 0,
            reserves: balance::zero<CoinType>(),
            donation_reserves: balance::zero<CoinType>(),
            total_borrows: 0,
            borrow_index: DECIMAL as u64,
            supply_index: DECIMAL as u64,
            borrow_rate: 0,
            supply_rate: 0,
            last_update_time: clock::timestamp_ms(clock),
            extra_supply_interest_rate_bonus: SUPPLY_INTEREST_RATE_BONUS_INITIAL,
            borrow_interest_rate_discount: BORROW_INTEREST_RATE_DISCOUNT_INITIAL,
            max_donation_to_lend_ratio: 5000,
            total_donations: 0,
            donations_lent_out: 0,
        };
        donate(&mut pool, donate_coin);
        // 发出添加资产事件
        event::emit(
            AddAssetEvent {
                type_name: coin_type,
                ltv: TOKEN_LTV,
                liquidation_threshold: TOKEN_LIQUIDATION_THRESHOLD
            }
        );
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

        // 检查资金池余额是否足够,如果不够尝试从捐赠储备金补充
        let current_reserves = balance::value(&pool.reserves);
        if (current_reserves < amount) {
            let supplemented = supplement_reserves(pool, amount);
            assert!(
                current_reserves + supplemented >= amount,
                EInsufficientPoolBalance
            );
        };

        // 检查借款金额是否超过最大可借额度
        let borrow_value = (amount as u128) * DECIMAL; // 因为 TESTSUI 价格为 1
        let max_borrow_value = calculate_max_borrow_value(storage, user);

        // 计算当前已借金额
        let user_position = table::borrow(&storage.user_positions, user);
        let current_borrows = calculate_user_total_borrow_value_with_additional_weight(user_position, storage);

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

        // 尝试归还捐赠储备金
        restore_donation_reserves(pool, actual_repay_amount);

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

    public entry fun supply_token_a<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &mut CetusPool<CoinType, TESTSUI>,
        supply_coin: &mut Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_a(storage, cetus_pool, clock);

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

    public entry fun supply_token_b<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &mut CetusPool<TESTSUI, CoinType>,
        supply_coin: &mut Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_b(storage, cetus_pool, clock);

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

    public entry fun withdraw_token_a<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_a(storage, cetus_pool, clock);

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

    public entry fun withdraw_token_b<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<TESTSUI, CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_b(storage, cetus_pool, clock);

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

    public entry fun borrow_token_a<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_a(storage, cetus_pool, clock);

        let coin_type = type_name::get<CoinType>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );

        let token_price = *table::borrow(&storage.price, coin_type);
        
        // 检查代币价格是否达到最低阈值
        assert!(
            token_price >= MIN_BORROW_PRICE,
            ETokenPriceTooLow
        );


        // 检查资金池余额是否足够,如果不够尝试从捐赠储备金补充
        let current_reserves = balance::value(&pool.reserves);
        if (current_reserves < amount) {
            let supplemented = supplement_reserves(pool, amount);
            assert!(
                current_reserves + supplemented >= amount,
                EInsufficientPoolBalance
            );
        };



        let borrow_value = ((amount as u128) * token_price) / DECIMAL; // 转换为 SUI 价值
        let max_borrow_value = calculate_max_borrow_value(storage, user);

        // 计算当前已借金额
        let user_position = table::borrow(&storage.user_positions, user);
        let current_borrows = calculate_user_total_borrow_value_with_additional_weight(user_position, storage);

        assert!(
            current_borrows + borrow_value * TOKEN_DEBT_MULTIPLIER <= max_borrow_value,
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

    public entry fun borrow_token_b<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<TESTSUI, CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_b(storage, cetus_pool, clock);

        let coin_type = type_name::get<CoinType>();
        let user = tx_context::sender(ctx);

        // 检查用户是否有仓位
        assert!(
            table::contains(&storage.user_positions, user),
            EInsufficientBalance
        );
        let token_price = *table::borrow(&storage.price, coin_type);
        
        // 检查代币价格是否达到最低阈值
        assert!(
            token_price >= MIN_BORROW_PRICE,
            ETokenPriceTooLow
        );


        // 检查资金池余额是否足够,如果不够尝试从捐赠储备金补充
        let current_reserves = balance::value(&pool.reserves);
        if (current_reserves < amount) {
            let supplemented = supplement_reserves(pool, amount);
            assert!(
                current_reserves + supplemented >= amount,
                EInsufficientPoolBalance
            );
        };

        let borrow_value = ((amount as u128) * token_price) / DECIMAL; // 转换为 SUI 价值
        let max_borrow_value = calculate_max_borrow_value(storage, user);

        // 计算当前已借金额
        let user_position = table::borrow(&storage.user_positions, user);
        let current_borrows = calculate_user_total_borrow_value_with_additional_weight(user_position, storage);

        assert!(
            current_borrows + borrow_value * TOKEN_DEBT_MULTIPLIER <= max_borrow_value,
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

    public entry fun repay_token_a<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        repay_coin: &mut Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_a(storage, cetus_pool, clock);

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

        // 尝试归还捐赠储备金
        restore_donation_reserves(pool, actual_repay_amount);

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

    public entry fun repay_token_b<CoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        pool: &mut LendingPool<CoinType>,
        cetus_pool: &CetusPool<TESTSUI, CoinType>,
        repay_coin: &mut Coin<CoinType>,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(pool, clock);

        // 更新资产价格
        update_asset_price_b(storage, cetus_pool, clock);

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

        // 尝试归还捐赠储备金
        restore_donation_reserves(pool, actual_repay_amount);

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
    public entry fun liquidate<DebtCoinType, CollateralCoinType>(
        clock: &Clock,
        storage: &mut LendingStorage,
        debt_pool: &mut LendingPool<DebtCoinType>,
        debt_coin: &mut Coin<DebtCoinType>,
        collateral_pool: &mut LendingPool<CollateralCoinType>,
        liquidate_user: address,
        liquidate_amount: u64,
        ctx: &mut TxContext
    ) {
        // 更新利率
        update_interest_rate(debt_pool, clock);
        update_interest_rate(collateral_pool, clock);

        let debt_type = type_name::get<DebtCoinType>();
        let collateral_type = type_name::get<CollateralCoinType>();

        // 获取清算人地址
        let liquidator = tx_context::sender(ctx);

        // 检查被清算用户的健康因子是否小于1
        let health_factor = calculate_health_factor(storage, liquidate_user);
        assert!(health_factor < 100, 0); // 健康因子必须小于1

        // 如果不是TESTSUI,检查价格是否在15秒内更新过
        if (debt_type != type_name::get<TESTSUI>()) {
            let price_update_time = *table::borrow(&storage.price_update_time, debt_type);
            assert!(
                clock::timestamp_ms(clock) - price_update_time <= 15000,
                0
            );
        };
        if (collateral_type != type_name::get<TESTSUI>()) {
            let price_update_time = *table::borrow(&storage.price_update_time, collateral_type);
            assert!(
                clock::timestamp_ms(clock) - price_update_time <= 15000,
                0
            );
        };

        // 获取被清算用户的仓位
        let user_position = table::borrow_mut(&mut storage.user_positions, liquidate_user);

        // 检查被清算用户是否有对应的债务和抵押品
        assert!(
            table::contains(&user_position.borrows, debt_type),
            0
        );
        assert!(
            table::contains(&user_position.supplies, collateral_type),
            0
        );

        // 计算实际债务金额
        let actual_debt = calculate_user_actual_borrow_amount(debt_pool, user_position, debt_type);
        
        // 限制清算金额不超过实际债务的50%
        let actual_liquidate_amount = if (liquidate_amount > actual_debt / 2) {
            actual_debt / 2
        } else {
            liquidate_amount
        };

        // 检查清算人提供的代币是否足够
        assert!(
            coin::value(debt_coin) >= actual_liquidate_amount,
            0
        );

        // 计算要获得的抵押品数量(使用折扣价格)
        let debt_price = *table::borrow(&storage.price, debt_type);
        let collateral_price = *table::borrow(&storage.price, collateral_type);
        
        // 计算抵押品价值 = 债务价值 / (1 - 清算折扣)
        // 例如: 如果债务价值是100 SUI,清算折扣是20%,那么清算人只需要支付80 SUI就能获得100 SUI价值的抵押品
        let collateral_amount = (
            ((actual_liquidate_amount as u128) * debt_price * 100) 
            / (collateral_price * (100 - LIQUIDATION_DISCOUNT as u128))
        ) as u64;

        // 更新被清算用户的债务记录
        let remaining_debt = actual_debt - actual_liquidate_amount;
        if (remaining_debt == 0) {
            table::remove(&mut user_position.borrows, debt_type);
            table::remove(&mut user_position.borrow_index_snapshots, debt_type);
        } else {
            let borrow_value = table::borrow_mut(&mut user_position.borrows, debt_type);
            *borrow_value = remaining_debt;
            let index_snapshot = table::borrow_mut(&mut user_position.borrow_index_snapshots, debt_type);
            *index_snapshot = debt_pool.borrow_index;
        };

        // 更新被清算用户的抵押品记录
        let actual_supply = calculate_user_actual_supply_amount(collateral_pool, user_position, collateral_type);
        assert!(actual_supply >= collateral_amount, 0);
        
        let remaining_supply = actual_supply - collateral_amount;
        if (remaining_supply == 0) {
            table::remove(&mut user_position.supplies, collateral_type);
            table::remove(&mut user_position.supply_index_snapshots, collateral_type);
        } else {
            let supply_value = table::borrow_mut(&mut user_position.supplies, collateral_type);
            *supply_value = remaining_supply;
            let index_snapshot = table::borrow_mut(&mut user_position.supply_index_snapshots, collateral_type);
            *index_snapshot = collateral_pool.supply_index;
        };

        // 更新借款总额
        debt_pool.total_borrows = debt_pool.total_borrows - actual_liquidate_amount;
        collateral_pool.total_supplies = collateral_pool.total_supplies - collateral_amount;

        // 将清算人的代币存入债务资金池
        let split_debt_coin = coin::split(debt_coin, actual_liquidate_amount, ctx);
        let debt_balance = coin::into_balance(split_debt_coin);
        balance::join(&mut debt_pool.reserves, debt_balance);

        // 从抵押品资金池取出抵押品给清算人
        let collateral_balance = balance::split(&mut collateral_pool.reserves, collateral_amount);
        let collateral_coin = coin::from_balance(collateral_balance, ctx);
        transfer::public_transfer(collateral_coin, liquidator);

        // 尝试归还捐赠储备金
        restore_donation_reserves(debt_pool, actual_liquidate_amount);

        // 更新利率
        update_interest_rate(debt_pool, clock);
        update_interest_rate(collateral_pool, clock);

        // 发出清算事件
        event::emit(
            LiquidationEvent {
                liquidator,
                user: liquidate_user,
                debt_asset_type: debt_type,
                collateral_asset_type: collateral_type,
                debt_amount: actual_liquidate_amount,
                collateral_amount
            }
        );
    }

    public entry fun update_asset_price_a<CoinType>(
        storage: &mut LendingStorage,
        cetus_pool: &CetusPool<CoinType, TESTSUI>,
        clock: &Clock,
    ) {
        let coin_type = type_name::get<CoinType>();
        
        // 获取池子中的余额
        let (balance_a, balance_b) = cetus_pool.balances();
        
        // 计算价格 (sui/token)
        let price = (
            (balance::value(balance_b) as u128) * DECIMAL
        ) / (balance::value(balance_a) as u128);
        
        // 更新价格
        let stored_price = table::borrow_mut(
            &mut storage.price,
            coin_type
        );
        *stored_price = price;

        // 更新价格更新时间
        let update_time = table::borrow_mut(
            &mut storage.price_update_time,
            coin_type
        );
        *update_time = clock::timestamp_ms(clock);
    }

    public entry fun update_asset_price_b<CoinType>(
        storage: &mut LendingStorage,
        cetus_pool: &CetusPool<TESTSUI, CoinType>,
        clock: &Clock,
    ) {
        let coin_type = type_name::get<CoinType>();
        
        // 获取池子中的余额
        let (balance_a, balance_b) = cetus_pool.balances();
        
        // 计算价格 (sui/token)
        let price = (
            (balance::value(balance_a) as u128) * DECIMAL
        ) / (balance::value(balance_b) as u128);
        
        // 更新价格
        let stored_price = table::borrow_mut(
            &mut storage.price,
            coin_type
        );
        *stored_price = price;

        // 更新价格更新时间
        let update_time = table::borrow_mut(
            &mut storage.price_update_time,
            coin_type
        );
        *update_time = clock::timestamp_ms(clock);
    }

    // === 查询函数 ===



    public entry fun get_user_position(
        storage: &LendingStorage,
        user: address
    ) {
        // 检查用户是否有仓位
        if (!table::contains(&storage.user_positions, user)) {
            // 用户没有仓位时，返回空数据
            let mut empty_assets: vector<TypeName> = vector::empty();
            let mut empty_supplies: vector<u64> = vector::empty();
            let mut empty_borrows: vector<u64> = vector::empty();
            let mut empty_snapshots: vector<u64> = vector::empty();

            // 遍历所有支持的资产，添加空数据
            let mut i = 0;
            let assets_len = vector::length(&storage.supported_assets);
            while (i < assets_len) {
                let asset_info = vector::borrow(&storage.supported_assets, i);
                vector::push_back(&mut empty_assets, asset_info.type_name);
                vector::push_back(&mut empty_supplies, 0);
                vector::push_back(&mut empty_borrows, 0);
                vector::push_back(&mut empty_snapshots, 0);
                i = i + 1;
            };

            event::emit(
                GetUserPositionEvent {
                    user,
                    assets: empty_assets,
                    supplies: empty_supplies,
                    borrows: empty_borrows,
                    borrow_index_snapshots: empty_snapshots,
                    supply_index_snapshots: empty_snapshots,
                    borrow_value: 0,
                    supply_value: 0,
                }
            );
            return
        };

        // 原有的处理逻辑
        let user_position = table::borrow(&storage.user_positions, user);
        let mut assets: vector<TypeName> = vector::empty();
        let mut supplies: vector<u64> = vector::empty();
        let mut borrows: vector<u64> = vector::empty();
        let mut borrow_index_snapshots: vector<u64> = vector::empty();
        let mut supply_index_snapshots: vector<u64> = vector::empty();
        let mut total_borrow_value: u128 = 0;
        let mut total_supply_value: u128 = 0;

        let mut i = 0;
        let assets_len = vector::length(&storage.supported_assets);
        while (i < assets_len) {
            let asset_info = vector::borrow(&storage.supported_assets, i);
            vector::push_back(&mut assets, asset_info.type_name);
            
            // 获取资产价格
            let price = *table::borrow(&storage.price, asset_info.type_name);

            // 存款金额
            if (table::contains(&user_position.supplies, asset_info.type_name)) {
                let supply_amount = *table::borrow(
                    &user_position.supplies,
                    asset_info.type_name
                );
                vector::push_back(&mut supplies, supply_amount);
                // 计算存款价值（转换为 SUI）
                total_supply_value = total_supply_value + (
                    (supply_amount as u128) * price
                ) / DECIMAL;
            } else {
                vector::push_back(&mut supplies, 0);
            };

            // 借款金额
            if (table::contains(&user_position.borrows, asset_info.type_name)) {
                let borrow_amount = *table::borrow(
                    &user_position.borrows,
                    asset_info.type_name
                );
                vector::push_back(&mut borrows, borrow_amount);
                // 计算借款价值（转换为 SUI）
                total_borrow_value = total_borrow_value + (
                    (borrow_amount as u128) * price
                ) / DECIMAL;
            } else {
                vector::push_back(&mut borrows, 0);
            };

            // 借款利率快照
            if (table::contains(&user_position.borrow_index_snapshots, asset_info.type_name)) {
                vector::push_back(&mut borrow_index_snapshots, *table::borrow(
                    &user_position.borrow_index_snapshots,
                    asset_info.type_name
                ));
            } else {
                vector::push_back(&mut borrow_index_snapshots, 0);
            };

            // 存款利率快照
            if (table::contains(&user_position.supply_index_snapshots, asset_info.type_name)) {
                vector::push_back(&mut supply_index_snapshots, *table::borrow(
                    &user_position.supply_index_snapshots,
                    asset_info.type_name
                ));
            } else {
                vector::push_back(&mut supply_index_snapshots, 0);
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
                borrow_value: total_borrow_value,
                supply_value: total_supply_value,
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

                if (asset_info.type_name != type_name::get<TESTSUI>() && price < MIN_BORROW_PRICE){
                    i = i + 1;
                    continue
                };
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
            event::emit(
            CalculateHealthFactorEvent {
                user,
                health_factor: 1000000
            }
        );
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

                if (asset_info.type_name != type_name::get<TESTSUI>() && price < MIN_BORROW_PRICE){
                    i = i + 1;
                    continue
                };
                // 将抵押物价值转换为 SUI (使用 LTV)
                let value_in_ltv = (
                    (supply_amount as u128) * price * (asset_info.ltv as u128)
                ) / 100 ;
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

    // 计算剩余可借款价值的函数
    public entry fun calculate_remaining_borrow_value(
        storage: &LendingStorage,
        user: address
    ): u128 {
        // 检查用户是否有仓位
        if (!table::contains(&storage.user_positions, user)) {
            return 0
        };

        let user_position = table::borrow(&storage.user_positions, user);
        let max_borrow_value = calculate_max_borrow_value(storage, user);
        let total_borrow_value = calculate_user_total_borrow_value_with_additional_weight(user_position, storage);
        let remaining_value = if (max_borrow_value < total_borrow_value) {
            0
        } else {
            max_borrow_value - total_borrow_value
        };
        event::emit(
            CalculateRemainingBorrowValueEvent {
                user,
                remaining_borrow_value: remaining_value
            }
        );
        remaining_value
    }

    

    

    // === 内部函数 ===

    // 利率计算相关函数
    fun compute_borrow_rate<CoinType>(pool: &LendingPool<CoinType>) : (u128,u128) {
        let total_supplies = pool.total_supplies;
        let total_borrows = pool.total_borrows;
        
        // 当存款为0但借款不为0时,返回最高利率
        if (total_supplies == 0 && total_borrows > 0) {
            let max_rate = R_BASE + R_SLOPE1 + R_SLOPE2; // 最高利率 = 基础利率 + 第一阶段斜率 + 第二阶段斜率

            let discount = (pool.borrow_interest_rate_discount * 100) / 10000;
            (max_rate, max_rate - discount)
        } else if (total_supplies == 0 || total_borrows == 0) {
            // 当存款和借款都为0,或只有存款没有借款时,返回基础利率
            (R_BASE, 0)
        } else {
            // 正常计算利率
            // 计算利用率 (放大到DECIMAL)
            let utilization_rate = ((total_borrows as u128) * DECIMAL) / (total_supplies as u128);
            
            // 利用率转换为百分比 (0-10000)
            let utilization_rate_percent = utilization_rate * 10000 / DECIMAL;

            // 计算基础借款利率
            let base_borrow_rate = if (utilization_rate_percent <= U_OPTIMAL) {
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
            };

            // 应用借款利率折扣(确保不会低于0)
            if (base_borrow_rate > pool.borrow_interest_rate_discount) {
                let discount = (pool.borrow_interest_rate_discount * 100) / 10000;
                (base_borrow_rate, base_borrow_rate - discount)
            } else {
                (base_borrow_rate, 0)
            }
        }
    }

    // 修改计算存款利率的函数,加入额外利率加成
    fun compute_supply_rate<CoinType>(pool: &LendingPool<CoinType>) : (u128,u128) {
        let (borrow_rate,_) = compute_borrow_rate(pool);
        let base_supply_rate = ((borrow_rate * (10000 - RESERVE_FACTOR * 100)) / 10000);
        // 将存款利率加成转换为正确的精度
        let bonus = (pool.extra_supply_interest_rate_bonus * 100) / 10000;
        (base_supply_rate, base_supply_rate + bonus)
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
        
        // 根据捐赠储备金比例调整利率激励
        adjust_donation_based_rates(pool);
        
        // 计算基础借款和存款年化利率
        let (borrow_rate,borrow_rate_with_discount) = compute_borrow_rate(pool);
        let (supply_rate,supply_rate_with_bonus) = compute_supply_rate(pool);
        
        // 计算这段时间的实际利率
        let mut actual_borrow_rate = calc_borrow_rate(borrow_rate_with_discount, time_delta);
        let mut actual_supply_rate = calc_borrow_rate(supply_rate_with_bonus, time_delta);

        // 计算需要补贴的利息总额
        let total_supplies = (pool.total_supplies as u128);
        let total_borrows = (pool.total_borrows as u128);

        // 计算存款利率加成需要的补贴
        let supply_bonus_needed = (
            total_supplies * pool.extra_supply_interest_rate_bonus * (time_delta as u128)
        ) / (YEAR_MS * 1000000); // 需要除以 100 * 10000 因为 bonus 现在是 2500 表示 25%

        // 计算借款利率折扣需要的补贴
        let borrow_discount_needed = (
            total_borrows * pool.borrow_interest_rate_discount * (time_delta as u128)
        ) / (YEAR_MS * 1000000); // 需要除以 100 * 10000 因为 discount 现在是 2500 表示 25%

        // 计算本次更新周期需要的总补贴
        let total_subsidy_needed = supply_bonus_needed + borrow_discount_needed;
        
        // 检查捐赠储备金是否足够支付补贴
        let available_donation = (balance::value(&pool.donation_reserves) as u128);
        
        if (available_donation < total_subsidy_needed) {
            // 如果捐赠储备金不足,按比例缩减利率加成和折扣
            let reduction_ratio = available_donation * 10000 / total_subsidy_needed;
            pool.extra_supply_interest_rate_bonus = 
                (pool.extra_supply_interest_rate_bonus * reduction_ratio) / 10000;
            pool.borrow_interest_rate_discount = 
                (pool.borrow_interest_rate_discount * reduction_ratio) / 10000;
            
            // 重新计算实际利率
            let (_,borrow_rate_with_discount) = compute_borrow_rate(pool);
            let (_,supply_rate_with_bonus) = compute_supply_rate(pool);
            actual_borrow_rate = calc_borrow_rate(borrow_rate_with_discount, time_delta);
            actual_supply_rate = calc_borrow_rate(supply_rate_with_bonus, time_delta);
        };

        // 从捐赠储备金转移补贴到储备金
        let donation_balance = balance::split(&mut pool.donation_reserves, (total_subsidy_needed as u64));
        balance::join(&mut pool.reserves, donation_balance);


        // 更新总借款金额
        let new_total_borrows = (
            total_borrows * (DECIMAL + actual_borrow_rate)
        ) / DECIMAL;
        pool.total_borrows = (new_total_borrows as u64);

        // 更新总存款金额
        let new_total_supplies = (
            total_supplies * (DECIMAL + actual_supply_rate)
        ) / DECIMAL;
        pool.total_supplies = (new_total_supplies as u64);

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

    // 计算用户总借款价值（增加token权重）
    fun calculate_user_total_borrow_value_with_additional_weight(
        user_position: &UserPosition,
        storage: &LendingStorage
    ): u128 {
        // 遍历所有借款
        let mut i = 0;
        let assets_len = vector::length(&storage.supported_assets);
        let mut total_borrow_value = 0;
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
                let borrow_value = (borrow_amount as u128) * price;
                if (asset_info.type_name == type_name::get<TESTSUI>()) {
                    total_borrow_value = total_borrow_value + borrow_value;
                } else {
                    total_borrow_value = total_borrow_value + borrow_value * TOKEN_DEBT_MULTIPLIER;
                };
            };
            i = i + 1;
        };
        total_borrow_value
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

    // 从捐赠储备金补充流动性
    fun supplement_reserves<CoinType>(
        pool: &mut LendingPool<CoinType>,
        amount_needed: u64
    ): u64 {
        // 获取当前储备金余额
        let current_reserves = balance::value(&pool.reserves);
        
        // 如果储备金足够,直接返回0(不需要补充)
        if (current_reserves >= amount_needed) {
            return 0
        };

        // 计算需要补充的数量
        let shortfall = amount_needed - current_reserves;

        // 计算可从捐赠储备金中转出的最大额度
        let donation_reserves_value = balance::value(&pool.donation_reserves);
        
        // 计算基于历史捐赠总额的可借出上限
        let max_donation_lend_amount = (
            (pool.total_donations as u128) * pool.max_donation_to_lend_ratio
        ) / 10000;

        // 计算当前还可以借出的额度
        let remaining_lendable = if (max_donation_lend_amount > (pool.donations_lent_out as u128)) {
            ((max_donation_lend_amount - (pool.donations_lent_out as u128)) as u64)
        } else {
            0
        };

        // 确定实际可补充的数量
        let mut supplemental_amount = if ((shortfall as u128) <= (remaining_lendable as u128)) {
            shortfall
        } else {
            remaining_lendable
        };

        // 确保不超过实际的捐赠储备金余额
        if (supplemental_amount > donation_reserves_value) {
            supplemental_amount = donation_reserves_value;
        };

        // 从捐赠储备金中转移代币到主储备金
        if (supplemental_amount > 0) {
            let supplemental_balance = balance::split(&mut pool.donation_reserves, supplemental_amount);
            balance::join(&mut pool.reserves, supplemental_balance);
            // 更新已借出的捐赠资金总额
            pool.donations_lent_out = pool.donations_lent_out + supplemental_amount;

            // 重新调整利率激励
            adjust_donation_based_rates(pool);
        };

        supplemental_amount
    }

    // 处理还款时归还捐赠储备金
    fun restore_donation_reserves<CoinType>(
        pool: &mut LendingPool<CoinType>,
        repay_amount: u64
    ) {
        // 如果没有需要归还的捐赠资金,直接返回
        if (pool.donations_lent_out == 0) {
            return
        };

        // 计算需要归还到捐赠储备金的数量
        let to_restore = if (repay_amount > pool.donations_lent_out) {
            pool.donations_lent_out
        } else {
            repay_amount
        };

        // 从主储备金中分离出需要归还的金额
        let restore_balance = balance::split(&mut pool.reserves, to_restore);
        
        // 将分离出的金额加入捐赠储备金
        balance::join(&mut pool.donation_reserves, restore_balance);
        
        // 更新已借出的捐赠资金总额
        pool.donations_lent_out = pool.donations_lent_out - to_restore;

        // 重新调整利率激励
        adjust_donation_based_rates(pool);
    }

    // 修改利率激励动态调整函数
    fun adjust_donation_based_rates<CoinType>(pool: &mut LendingPool<CoinType>) {
        // 如果没有历史捐赠,直接返回
        if (pool.total_donations == 0) {
            return
        };

        // 计算当前捐赠储备金占总捐赠的比例(basis points)
        let donation_ratio = (
            (balance::value(&pool.donation_reserves) as u128) * 10000
        ) / (pool.total_donations as u128);

        // 根据捐赠比例调整利率激励
        let new_supply_bonus = (
            SUPPLY_INTEREST_RATE_BONUS_INITIAL * donation_ratio
        ) / 10000;

        let new_borrow_discount = (
            BORROW_INTEREST_RATE_DISCOUNT_INITIAL * donation_ratio
        ) / 10000;

        // 如果调整后的利率激励低于最低阈值,则设为0
        pool.extra_supply_interest_rate_bonus = if (new_supply_bonus >= MIN_INTEREST_RATE_BONUS) {
            new_supply_bonus
        } else {
            0
        };

        pool.borrow_interest_rate_discount = if (new_borrow_discount >= MIN_INTEREST_RATE_BONUS) {
            new_borrow_discount
        } else {
            0
        };
    }

}
