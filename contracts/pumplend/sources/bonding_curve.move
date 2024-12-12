module pumplend::bonding_curve {
    use legato_math::fixed_point64::{Self, FixedPoint64};
    use legato_math::math_fixed64;
    use legato_math::legato_math;

    const B: u128 = 5;

    const A: u128 = 1866;

    const DECIMALS: u128 = 1_000_000_000;


    /// 返回带指定精度的数值
    public fun get_value_with_precision(num: FixedPoint64, precision: u8): u128 {
        let raw = fixed_point64::get_raw_value(num);
        let mut scale = 1u128;
        let mut i = 0u8;
        while (i < precision) {
            scale = scale * 10;
            i = i + 1;
        };
        
        // 将64位定点数转换为指定精度
        // 先右移64位得到整数部分
        let integer = raw >> 64;
        // 取小数部分并进行缩放
        let frac = raw & ((1u128 << 64) - 1);
        let scaled_frac = (frac * scale) >> 64;
        
        integer * scale + scaled_frac
    }

    /// 计算买入数量
    /// delta_y: 投入的资金量
    /// x_0: 当前池中的token数量
    public entry fun calculate_buy_amount(delta_y: u64, x_0: u64): u64 {
        // 将输入转换为 FixedPoint64
        let x0_fixed = fixed_point64::create_from_rational((x_0 as u128), DECIMALS);
        let  b_fixed = fixed_point64::create_from_rational(B, DECIMALS);
        let  a_fixed = fixed_point64::create_from_rational(A, DECIMALS);
        let dy_fixed = fixed_point64::create_from_rational((delta_y as u128 ),DECIMALS);

        // 计算 exp(b*x0)
        let b_x0 = math_fixed64::mul_div(
            b_fixed,
            x0_fixed,
            fixed_point64::create_from_u128(1)
        );
        let exp_b_x0 = math_fixed64::exp(b_x0);

        // 计算 dy*b/a
        let dy_b = math_fixed64::mul_div(dy_fixed, b_fixed, a_fixed);

        // 计算 exp(b*x0) + (dy*b/a)
        let exp_b_x1 = fixed_point64::add(exp_b_x0, dy_b);

        // 计算 ln(exp_b_x1)
        let ln_exp_b_x1 = legato_math::ln(exp_b_x1);

        // 计算 ln(exp_b_x1)/b
        let result = math_fixed64::mul_div(
            ln_exp_b_x1,
            fixed_point64::create_from_u128(1),
            b_fixed
        );

        // 计算 ln(exp_b_x1)/b - x0
        let delta_x = fixed_point64::sub(result, x0_fixed);
        
        get_value_with_precision(delta_x, 9) as u64
    }

    /// 计算卖出获得的资金量
    /// delta_x: 卖出的token数量
    /// x_0: 当前池中的token数量
    public entry fun calculate_sell_return(delta_x: u64, x_0: u64): u64 {
        // 将输入转换为 FixedPoint64
        let x0_fixed = fixed_point64::create_from_rational((x_0 as u128), DECIMALS);
        let dx_fixed = fixed_point64::create_from_rational((delta_x as u128), DECIMALS);
        let b_fixed = fixed_point64::create_from_rational(B, DECIMALS);
        let a_fixed = fixed_point64::create_from_rational(A, DECIMALS);

        // 计算 exp(b*x0)
        let b_x0 = math_fixed64::mul_div(
            b_fixed,
            x0_fixed,
            fixed_point64::create_from_u128(1)
        );
        let exp_b_x0 = math_fixed64::exp(b_x0);

        // 计算 exp(b*(x0-dx))
        let x1_fixed = fixed_point64::sub(x0_fixed, dx_fixed);
        let b_x1 = math_fixed64::mul_div(
            b_fixed,
            x1_fixed,
            fixed_point64::create_from_u128(1)
        );
        let exp_b_x1 = math_fixed64::exp(b_x1);

        // 计算 exp(b*x0) - exp(b*x1)
        let delta_exp = fixed_point64::sub(exp_b_x0, exp_b_x1);

        // 计算 (a/b)*(exp(b*x0) - exp(b*x1))
        let result = math_fixed64::mul_div(a_fixed, delta_exp, b_fixed);


        get_value_with_precision(result, 9) as u64
    }

    #[test]
    fun test_buy_amount() {
        let delta_y = DECIMALS as u64;
        let x_0 = 0;
        let result = calculate_buy_amount(delta_y, x_0);
        std::debug::print(&result);
    }

    #[test]
    fun test_find_a_b() {
        // 基础参数
        let total_supply: u128 = 1_000_000_000 * DECIMALS;  // 10亿代币
        let funding_token: u128 = total_supply * 4 / 5;  // 8亿代币用于募资
        let funding_sui: u128 = 20_000 * DECIMALS;  // 目标募资额
        let amm_token: u128 = total_supply - funding_token;  // 2亿代币
        
        // 计算目标AMM价格 C = funding_sui / amm_token
        let target_price = fixed_point64::create_from_rational(funding_sui, amm_token);
        
        let mut best_b: u128 = 0;
        let mut best_a: u128 = 0;
        let mut min_diff = fixed_point64::create_from_u128(100000); // 设置一个较大的初始差值
        
        let mut b = 1u128;
        while (b <= 100) {
            let mut a = 1u128;
            while (a <= 2000) {
                // 计算bonding curve在funding_token处的价格
                let b_fixed = fixed_point64::create_from_rational(b, DECIMALS);
                let a_fixed = fixed_point64::create_from_rational(a, DECIMALS);
                
                // 计算 b * funding_token
                let b_x = math_fixed64::mul_div(
                    b_fixed,
                    fixed_point64::create_from_rational(funding_token, DECIMALS),
                    fixed_point64::create_from_u128(1)
                );
                
                // 计算 exp(b * funding_token)
                let exp_b_x = math_fixed64::exp(b_x);
                
                // 计算 a * exp(b * funding_token)，即bonding curve价格
                let bc_price = math_fixed64::mul_div(a_fixed, exp_b_x, fixed_point64::create_from_u128(1));
                
                // 计算价格差
                let price_diff = if (fixed_point64::greater_or_equal(bc_price, target_price)) {
                    fixed_point64::sub(bc_price, target_price)
                } else {
                    fixed_point64::sub(target_price, bc_price)
                };
                
                // 如果找到更小的差值，更新最佳结果
                if (fixed_point64::less(price_diff, min_diff)) {
                    min_diff = price_diff;
                    best_a = a;
                    best_b = b;
                    
                    // 输出当前最佳结果
                    std::debug::print(&b);
                    std::debug::print(&a);
                    std::debug::print(&get_value_with_precision(bc_price, 9));
                    std::debug::print(&get_value_with_precision(target_price, 9));
                    std::debug::print(&get_value_with_precision(min_diff, 9));

                    if (get_value_with_precision(min_diff, 9) == 0) {
                        b = 110;
                        break  
                    };
                };
                
                a = a + 1;
            };
            b = b + 1;
        };
        
        // 验证找到的结果
        assert!(best_a > 0 && best_b > 0, 0);
    }

    // #[test]
    // fun test_buy_process() {
    //     let target_sui = 20_000 * DECIMALS;
    //     let mut current_sui = 0u128;
    //     let mut current_token = 0u128;
        
    //     // 每次购买1 SUI
    //     let buy_amount = 1 * DECIMALS;
        
    //     while (current_sui < target_sui) {
    //         // 计算当前可以买到的代币数量
    //         let delta_x = calculate_buy_amount(
    //             (buy_amount as u64), 
    //             (current_token as u64)
    //         );
            
    //         current_sui = current_sui + buy_amount;
    //         current_token = current_token + (delta_x as u128);
            
    //         // 每100 SUI打印一次数据
    //         if (current_sui % (100 * DECIMALS) == 0) {
    //             std::debug::print(&(current_sui / DECIMALS));
    //             std::debug::print(&(current_token / DECIMALS));
    //             std::debug::print(&((buy_amount * DECIMALS) / (delta_x as u128)));
    //         };
    //     };
        
    //     // 打印最终结果
    //     std::debug::print(&(current_sui / DECIMALS));
    //     std::debug::print(&(current_token / DECIMALS));
    //     std::debug::print(&((current_sui * DECIMALS) / current_token));
    // }

}
