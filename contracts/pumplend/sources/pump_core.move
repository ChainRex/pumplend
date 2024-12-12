module pumplend::pump_core {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::balance::{Self, Balance};
    use sui::math;
    use testsui::testsui::{ TESTSUI };
    use pumplend::bonding_curve;
    use cetus_clmm::pool_creator;
    use cetus_clmm::config::GlobalConfig;
    use cetus_clmm::factory::Pools as CetusPools;
    use cetus_clmm::pool::{Self,Pool as CetusPool};
    use cetus_clmm::position::{Self,Position};
    use cetus_clmm::tick_math;
    use sui::clock::Clock;
    use sui::coin::CoinMetadata;
    use sui::event;
    use pumplend::lending_core::{Self, LendingStorage, LendingPool};

    const DECIMALS: u64 = 1_000_000_000;
    const MAX_SUPPLY: u64 = 1_000_000_000 * DECIMALS;
    const FUNDING_SUI: u64 = 20000 * DECIMALS;
    const FUNDING_TOKEN: u64 = (MAX_SUPPLY * 4) / 5;

    const EInsufficientSUI: u64 = 1001;
    const EInsufficientTokenSupply: u64 = 1002;
    const EInsufficientToken: u64 = 1003;
    const EInsufficientCollateralBalance: u64 = 1004;
    const ECollateralStatusInvalid: u64 = 1005; 

    const TICK_SPACING: u32 = 60; // 使用 0.25% 的手续费率

    // 捐赠比例常量
    const DONATION_RATIO: u64 = 300; // 3%

    // === Structs ===

    public enum CollateralStatus has copy,store,drop{
        FUNDING,
        LIQUIDITY_POOL_PENDING, // 等待流动性创建
        LIQUIDITY_POOL_CREATED, // 流动性创建完成
    }

    public struct Collateral<phantom T> has key {
        id: UID,
        sui_balance: Balance<TESTSUI>,
        status: CollateralStatus
    }

    public struct TreasuryCapHolder<phantom T> has key {
        id: UID,
        treasury_cap: TreasuryCap<T>
    }

    public struct PositionHolder<phantom T> has key {
        id: UID,
        position: Position
    }

    // === Events ===



    public struct TokenStatusEvent<phantom T> has copy, drop {
        total_supply: u64,
        collected_sui: u64,
        status: CollateralStatus
    }


    // === Entry Functions ===

    /// 通过将treasury_cap包装，用户就只能在本合约的限制下铸造或销毁代币
    public entry fun create_collateral<T>(
        treasury_cap: TreasuryCap<T>,
        ctx: &mut TxContext
    ) {

        let collateral = Collateral<T> {
            id: object::new(ctx),
            sui_balance: balance::zero(),
            status: CollateralStatus::FUNDING
        };

        let treasury_cap_holder = TreasuryCapHolder<T> {
            id: object::new(ctx),
            treasury_cap,
        };

        transfer::share_object(collateral);
        transfer::share_object(treasury_cap_holder)
    }

    public entry fun buy<T>(
        collateral: &mut Collateral<T>,
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        payment: Coin<TESTSUI>,
        ctx: &mut TxContext
    ) {
        assert!(collateral.status == CollateralStatus::FUNDING, ECollateralStatusInvalid);
        let payment_value = coin::value(&payment);
        assert!(payment_value > 0, EInsufficientSUI);

        let mut payment_balance = coin::into_balance(payment);
        
        let current_pool_balance = balance::value(&collateral.sui_balance);
        let actual_payment_value = if (current_pool_balance + payment_value > FUNDING_SUI) {
            // 如果超过募资目标，计算实际需要的金额
            let refund_amount = (current_pool_balance + payment_value) - FUNDING_SUI;
            // 从支付金额中分离出需要退还的部分
            let refund_balance = balance::split(&mut payment_balance, refund_amount);
            // 创建退款代币并转账给用户
            let refund_coin = coin::from_balance(refund_balance, ctx);
            transfer::public_transfer(
                refund_coin,
                tx_context::sender(ctx)
            );
            payment_value - refund_amount
        } else {
            payment_value
        };

        let current_supply = coin::total_supply(&treasury_cap_holder.treasury_cap);
        let token_amount = bonding_curve::calculate_buy_amount(actual_payment_value, current_supply);
        
        assert!(
            current_supply + token_amount <= MAX_SUPPLY,
            EInsufficientTokenSupply
        );

        // 将实际支付金额加入池中
        balance::join(
            &mut collateral.sui_balance,
            payment_balance
        );

        coin::mint_and_transfer(
            &mut treasury_cap_holder.treasury_cap,
            token_amount,
            tx_context::sender(ctx),
            ctx
        );

        if (balance::value(&collateral.sui_balance) >= FUNDING_SUI) {
            collateral.status = CollateralStatus::LIQUIDITY_POOL_PENDING;
        };


        event::emit(TokenStatusEvent<T> {
            total_supply: (coin::total_supply(&treasury_cap_holder.treasury_cap) as u64),
            collected_sui: (balance::value(&collateral.sui_balance) as u64),
            status: collateral.status
        });
    }

    public entry fun sell<T>(
        collateral: &mut Collateral<T>,
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        token_coin: Coin<T>,
        ctx: &mut TxContext
    ) {
        assert!(collateral.status == CollateralStatus::FUNDING, ECollateralStatusInvalid);
        let token_amount = coin::value(&token_coin);
        assert!(token_amount > 0, EInsufficientToken);

        let current_supply = coin::total_supply(&treasury_cap_holder.treasury_cap);
        let sui_return = bonding_curve::calculate_sell_return(token_amount, current_supply);

        let collateral_balance = balance::value(&collateral.sui_balance);
        assert!(
            collateral_balance >= sui_return,
            EInsufficientCollateralBalance
        );

        coin::burn(
            &mut treasury_cap_holder.treasury_cap,
            token_coin
        );

        let sui_coin = coin::from_balance(
            balance::split(&mut collateral.sui_balance, sui_return),
            ctx
        );
        transfer::public_transfer(sui_coin, tx_context::sender(ctx));

        
        event::emit(TokenStatusEvent<T> {
            total_supply: (coin::total_supply(&treasury_cap_holder.treasury_cap) as u64),
            collected_sui: (balance::value(&collateral.sui_balance) as u64),
            status: collateral.status
        });
    }
    // 创建cetus流动性池
    public entry fun create_cetus_pool_t_sui<T>(
        collateral: &mut Collateral<T>,
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        config: &GlobalConfig,
        cetus_pools: &mut CetusPools,
        metadata_t: &CoinMetadata<T>,
        metadata_sui: &CoinMetadata<TESTSUI>,
        clock: &Clock,
        lending_storage: &mut LendingStorage,
        lending_pool_sui: &mut LendingPool<TESTSUI>,
        ctx: &mut TxContext
    ) {
        assert!(collateral.status == CollateralStatus::LIQUIDITY_POOL_PENDING, ECollateralStatusInvalid);
        
        // 计算用于捐赠的数量
        let token_amount_for_pool = MAX_SUPPLY - FUNDING_TOKEN;
        let token_amount_for_donation = (((token_amount_for_pool as u128) * (DONATION_RATIO as u128)) / 10000) as u64;
        let sui_amount_for_donation = (((balance::value(&collateral.sui_balance) as u128) * (DONATION_RATIO as u128)) / 10000) as u64;
        
        // 铸造代币(包括用于流动性和捐赠的部分)
        let mut pool_tokens = coin::mint(
            &mut treasury_cap_holder.treasury_cap,
            token_amount_for_pool,
            ctx
        );

        // 从池中取出募集到的 SUI (包括用于流动性和捐赠的部分)
        let mut pool_sui = coin::from_balance(
            balance::split(&mut collateral.sui_balance, FUNDING_SUI),
            ctx
        );

        // 分离出用于捐赠的代币
        let donation_tokens = coin::split(&mut pool_tokens, token_amount_for_donation, ctx);
        let donation_sui = coin::split(&mut pool_sui, sui_amount_for_donation, ctx);

        // 先捐赠 SUI 到借贷池
        lending_core::donate(lending_pool_sui, donation_sui);

        let price = ((coin::value(&pool_sui) as u128) * (DECIMALS as u128)) / (coin::value(&pool_tokens) as u128);

        // 创建 Cetus 流动性池
        let (position, remaining_coin_a, remaining_coin_b) = 
            pool_creator::create_pool_v2<T, TESTSUI>(
                config,
                cetus_pools,
                TICK_SPACING,
                184467440737095516,
                std::string::utf8(b""),
                4294523716,
                443580,
                pool_tokens,
                pool_sui,
                metadata_t,
                metadata_sui,
                true, // fix_amount_a
                clock,
                ctx
            );

        lending_core::add_token_asset_with_donation_and_price(
            lending_storage,
            price,
            donation_tokens,
            clock,
            ctx
        );

        // 返回给调用者
        transfer::public_transfer(remaining_coin_a, tx_context::sender(ctx));
        transfer::public_transfer(remaining_coin_b, tx_context::sender(ctx));
        
        let position_holder = PositionHolder<T> {
            id: object::new(ctx),
            position, 
        };
        transfer::share_object(position_holder);
        collateral.status = CollateralStatus::LIQUIDITY_POOL_CREATED;
        event::emit(TokenStatusEvent<T> {
            total_supply: (coin::total_supply(&treasury_cap_holder.treasury_cap) as u64),
            collected_sui: (balance::value(&collateral.sui_balance) as u64),
            status: collateral.status
        });
    }

    public entry fun create_cetus_pool_sui_t<T>(
        collateral: &mut Collateral<T>,
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        config: &GlobalConfig,
        cetus_pools: &mut CetusPools,
        metadata_t: &CoinMetadata<T>,
        metadata_sui: &CoinMetadata<TESTSUI>,
        clock: &Clock,
        lending_storage: &mut LendingStorage,
        lending_pool_sui: &mut lending_core::LendingPool<TESTSUI>,
        ctx: &mut TxContext
    ) {
        assert!(collateral.status == CollateralStatus::LIQUIDITY_POOL_PENDING, ECollateralStatusInvalid);
        
        // 计算用于捐赠的数量
        let token_amount_for_pool = MAX_SUPPLY - FUNDING_TOKEN;
        let token_amount_for_donation = (((token_amount_for_pool as u128) * (DONATION_RATIO as u128)) / 10000) as u64;
        let sui_amount_for_donation = (((balance::value(&collateral.sui_balance) as u128) * (DONATION_RATIO as u128)) / 10000) as u64;
        
        // 铸造代币(包括用于流动性和捐赠的部分)
        let mut pool_tokens = coin::mint(
            &mut treasury_cap_holder.treasury_cap,
            token_amount_for_pool,
            ctx
        );

        // 从池中取出募集到的 SUI (包括用于流动性和捐赠的部分)
        let mut pool_sui = coin::from_balance(
            balance::split(&mut collateral.sui_balance, FUNDING_SUI),
            ctx
        );

        // 分离出用于捐赠的代币
        let donation_tokens = coin::split(&mut pool_tokens, token_amount_for_donation, ctx);
        let donation_sui = coin::split(&mut pool_sui, sui_amount_for_donation, ctx);

        // 先捐赠 SUI 到借贷池
        lending_core::donate(lending_pool_sui, donation_sui);

        let price = ((coin::value(&pool_sui) as u128) * (DECIMALS as u128)) / (coin::value(&pool_tokens) as u128);

        // 创建 Cetus 流动性池
        let (position, remaining_coin_a, remaining_coin_b) = 
            pool_creator::create_pool_v2<TESTSUI, T>(
                config,
                cetus_pools,
                TICK_SPACING,
                1844674407370955161600,
                std::string::utf8(b""),
                4294523716,
                443580,
                pool_sui,
                pool_tokens,
                metadata_sui,
                metadata_t,
                false, // fix_amount_a
                clock,
                ctx
            );


        lending_core::add_token_asset_with_donation_and_price(
            lending_storage,
            price,
            donation_tokens,
            clock,
            ctx
        );

        // 返回给调用者
        transfer::public_transfer(remaining_coin_a, tx_context::sender(ctx));
        transfer::public_transfer(remaining_coin_b, tx_context::sender(ctx));
        
        let position_holder = PositionHolder<T> {
            id: object::new(ctx),
            position, 
        };
        transfer::share_object(position_holder);
        collateral.status = CollateralStatus::LIQUIDITY_POOL_CREATED;
        event::emit(TokenStatusEvent<T> {
            total_supply: (coin::total_supply(&treasury_cap_holder.treasury_cap) as u64),
            collected_sui: (balance::value(&collateral.sui_balance) as u64),
            status: collateral.status
        });
    }

}
