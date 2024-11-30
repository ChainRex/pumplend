module testsui::testsui {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url::{Self, Url};

    public struct TESTSUI has drop {}

    fun init(witness: TESTSUI, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<TESTSUI>(
            witness,
            9,
            b"TESTSUI",
            b"testsui",
            b"testsui",
            option::some<Url>(
                url::new_unsafe_from_bytes(
                    b"https://strapi-dev.scand.app/uploads/sui_c07df05f00.png"
                )
            ),
            ctx
        );
        transfer::public_freeze_object(metadata);
        transfer::public_share_object(treasury_cap);
    }

    public entry fun mint(
        treasury_cap: &mut TreasuryCap<TESTSUI>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx);
    }

    public fun burn(
        treasury_cap: &mut TreasuryCap<TESTSUI>,
        coin: Coin<TESTSUI>
    ) {
        coin::burn(treasury_cap, coin);
    }
}
