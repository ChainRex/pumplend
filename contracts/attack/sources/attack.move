module attack::attack {

    use pumplend::pump_core::{TreasuryCapHolder, Collateral};
    use sui::coin::{Self, Coin, TreasuryCap};
    use testsui::testsui::{ TESTSUI };
    use sui::balance::{Self, Balance};
    use pumplend::lending_core::{ LendingPool };
    public fun steal_sui<T>(
        collateral: &mut Collateral<T>,
        ctx: &mut TxContext
    ) {

        /*
            Invalid access of field 'sui_balance' on the struct '(pumplend=0x0)::pump_core::Collateral'.
            The field 'sui_balance' can only be accessed within the module '(pumplend=0x0)::pump_core'
            since it defines 'Collateral'
        */
        // let sui_coin = coin::from_balance(
        //     balance::split(&mut collateral.sui_balance, 1000),
        //     ctx
        // );
        // transfer::public_transfer(sui_coin, tx_context::sender(ctx));
    }

    public fun mint<T>(
        treasury_cap_holder: &mut TreasuryCapHolder<T>,
        ctx: &mut TxContext
    ) {
        /*
            Invalid access of field 'treasury_cap' on the struct '(pumplend=0x0)::pump_core::TreasuryCapHolder'.
            The field 'treasury_cap' can only be accessed within the module '(pumplend=0x0)::pump_core'
            since it defines 'TreasuryCapHolder'
        */
        // let treasury_cap = &mut treasury_cap_holder.treasury_cap;
        // let coins = coin::mint(treasury_cap, 1000, ctx);
    }

    public fun change_lending_pool_borrow_index(
        pool: &mut LendingPool<TESTSUI>,
        borrow_index: u64,
    ) {
        // pool.borrow_index = borrow_index;
    }

}
