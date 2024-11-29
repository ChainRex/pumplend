module attack::attack {

    use pumpsui::pumpsui_core::{ TreasuryCapHolder };
    use sui::coin::{Self, Coin, TreasuryCap};

    public fun mint<T>(
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        ctx: &mut TxContext
    ) {
        // 无法访问treasury_cap
        // let treasury_cap = &mut treasury_cap_holder.treasury_cap;
        // let coins = coin::mint(treasury_cap, 1000, ctx);
    }
}
