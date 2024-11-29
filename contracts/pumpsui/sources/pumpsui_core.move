module pumpsui::pumpsui_core {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};

    const FUNDING_SUI: u64 = 20;
    const FUNDING_TOKEN: u64 = 10 ^ 9 * 10 ^ 9;

    public struct Pool<phantom T> has key {
        id: UID,
        coin_balance: Balance<T>,
        sui_balance: Balance<SUI>,
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

}
