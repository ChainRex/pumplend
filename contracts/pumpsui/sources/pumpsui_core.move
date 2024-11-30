module pumpsui::pumpsui_core {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::balance::{Self, Balance};
    use sui::math;
    use testsui::testsui::{ TESTSUI };

    const DECIMALS: u64 = 1_000_000_000;
    const MAX_SUPPLY: u64 = 1_000_000_000 * DECIMALS;
    const FUNDING_SUI: u64 = 23000 * DECIMALS;
    const FUNDING_TOKEN: u64 = (MAX_SUPPLY * 4) / 5;

    const EInsufficientSUI: u64 = 1001;
    const EInsufficientTokenSupply: u64 = 1002;
    const EInsufficientToken: u64 = 1003;
    const EInsufficientPoolBalance: u64 = 1004;

    public struct Pool<phantom T> has key {
        id: UID,
        coin_balance: Balance<T>,
        sui_balance: Balance<TESTSUI>,
    }

    public struct TreasuryCapHolder<phantom T> has key {
        id: UID,
        treasury_cap: TreasuryCap<T>
    }

    /// 通过将treasury_cap包装，用户就只能在本合约的限制下铸造或销毁代币
    public entry fun create_pool<T>(
        treasury_cap: TreasuryCap<T>,
        ctx: &mut TxContext
    ) {

        let pool = Pool<T> {
            id: object::new(ctx),
            coin_balance: balance::zero(),
            sui_balance: balance::zero()
        };

        let treasury_cap_holder = TreasuryCapHolder<T> {
            id: object::new(ctx),
            treasury_cap,
        };

        transfer::share_object(pool);
        transfer::share_object(treasury_cap_holder)
    }

    public entry fun buy<T>(
        pool: &mut Pool<T>,
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        payment: Coin<TESTSUI>,
        ctx: &mut TxContext
    ) {
        let payment_value = coin::value(&payment);
        assert!(payment_value > 0, EInsufficientSUI);

        let token_amount = calculate_buy_return(payment_value);

        let current_supply = coin::total_supply(&treasury_cap_holder.treasury_cap);
        assert!(
            current_supply + token_amount <= MAX_SUPPLY,
            EInsufficientTokenSupply
        );

        let payment_balance = coin::into_balance(payment);
        balance::join(
            &mut pool.sui_balance,
            payment_balance
        );

        coin::mint_and_transfer(
            &mut treasury_cap_holder.treasury_cap,
            token_amount,
            tx_context::sender(ctx),
            ctx
        );

        if (balance::value(&pool.sui_balance) >= FUNDING_SUI) {
            // TODO: 检查是否达到 FUNDING_SUI 阈值，如果达到则创建流动性池

        };
    }

    public entry fun sell<T>(
        pool: &mut Pool<T>,
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        token_coin: Coin<T>,
        ctx: &mut TxContext
    ) {
        let token_amount = coin::value(&token_coin);
        assert!(token_amount > 0, EInsufficientToken);

        let sui_return = calculate_sell_return(token_amount);

        let pool_balance = balance::value(&pool.sui_balance);
        assert!(
            pool_balance >= sui_return,
            EInsufficientPoolBalance
        );

        coin::burn(
            &mut treasury_cap_holder.treasury_cap,
            token_coin
        );

        let sui_coin = coin::from_balance(
            balance::split(&mut pool.sui_balance, sui_return),
            ctx
        );
        transfer::public_transfer(sui_coin, tx_context::sender(ctx));
    }

    /// 计算购买返回的代币数量
    fun calculate_buy_return(sui_amount: u64): u64 {
        ((sui_amount as u256) * (FUNDING_TOKEN as u256) / (FUNDING_SUI as u256)) as u64
    }

    /// 计算出售代币应该返还的 SUI 数量
    fun calculate_sell_return(token_amount: u64): u64 {
        ((token_amount as u256) * (FUNDING_SUI as u256) / (FUNDING_TOKEN as u256)) as u64
    }

}
