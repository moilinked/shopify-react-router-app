import type { LoyaltyInitData, LoyaltyTransactionsData } from './types'

export const EDITOR_LOYALTY_INIT_DATA: LoyaltyInitData = {
  customer: {
    id: 3235166587,
    first_name: 'Jane',
    last_name: 'x',
    email: 'janejx00@gmail.com',
    points_balance: 2000,
    referral_url: 'https://i.refs.cc/MnTpTFqx',
    vip_status: {
      vip_tier_id: 422596,
      vip_tier_expires_at: null,
      progress_value: 0,
      current_vip_period_end: null,
      delta_to_retain_vip_tier: null,
      next_vip_tier_id: 422597,
      delta_to_next_vip_tier: 300
    }
  },
  shopify_customer: {
    email: 'janejx00@gmail.com',
    first_name: 'Jane',
    last_name: 'Test'
  },
  vip_tiers: [
    {
      id: 422595,
      name: 'Bronze',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/vip-tier/image/processed/56a7965421983595d7ca26de750cbed068e3ee895acf07bc5800b1c9227cdc4004f649f5afad0515.png',
      milestone: 0
    },
    {
      id: 868546,
      name: 'Silver',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/vip-tier/image/processed/41fd037ef9e93caff45e6f89d827e920030f36168b72201d28e4a8c49d1091a37fdbe5798e6f5715.png',
      milestone: 600
    },
    {
      id: 422596,
      name: 'Gold',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/vip-tier/image/processed/d8eca12f6188bf15ca1a046b8e3fbb120a66806cc7c14cf9cf88e22f2fe8016023c2ae3a6a4591ee.png',
      milestone: 1200
    },
    {
      id: 422597,
      name: 'Platinum',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/vip-tier/image/processed/dc5b6e0aec7d12be16b585fb508f3ec226e30ef246f75e035d0f0a852c99dcd6b6358ec7d7350759.png',
      milestone: 2000
    }
  ],
  points_products: [
    {
      id: 929030,
      exchange_type: 'fixed',
      exchange_description: '500 Points',
      points_price: 500,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2785665,
        name: 'Non-stackable 5% off Coupon',
        description:
          'Applies to one-time purchases. Reward expires 1 month after being issued. Reward can only be used on purchases of $100 or more.',
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/bd8dd59a1f677c52346f147a33103f7fa933d97a997b554763a657f4e6f6b324b3299b17c433979f.png'
      }
    },
    {
      id: 959219,
      exchange_type: 'fixed',
      exchange_description: '1000 Points',
      points_price: 1000,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2887341,
        name: 'Stackable $3 off Coupon',
        description: 'Applies to one-time purchases. Reward expires 1 month after being issued.',
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/7838b6093875904033cba75ccab9b874af6c92134123c54afe165b8e77804e752245671dd24ba926.png'
      }
    },
    {
      id: 992952,
      exchange_type: 'fixed',
      exchange_description: '3000 Points',
      points_price: 3000,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2996820,
        name: '$10 off coupon',
        description:
          "Reward can only be used while you're logged in. Applies to one-time purchases. Reward expires 7 days after being issued.",
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/3a73b6d717b467e6bc456ab0e5afe9b0c45e0d014c14a9ba750a1b5c99656b2dc9c4ec3aa1caff37.png'
      }
    },
    {
      id: 992953,
      exchange_type: 'fixed',
      exchange_description: '4500 Points',
      points_price: 4500,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2996821,
        name: '$15 off coupon',
        description:
          "Reward can only be used while you're logged in. Applies to one-time purchases. Reward expires 7 days after being issued.",
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/f6e5456251720b0b86fe337ce96d71a16ddfbd318e1e360ea843341bae059b32fe4e19b96f1ac960.png'
      }
    },
    {
      id: 992954,
      exchange_type: 'fixed',
      exchange_description: '6000 Points',
      points_price: 6000,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2996822,
        name: '$20 off coupon',
        description:
          "Reward can only be used while you're logged in. Applies to one-time purchases. Reward expires 7 days after being issued.",
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/b7ce62d7aa8ebd4abb060a8696d2baba5076c316f72f35190d06e39382ad9695339152749b136e88.png'
      }
    },
    {
      id: 962566,
      exchange_type: 'fixed',
      exchange_description: '9000 Points',
      points_price: 9000,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2897509,
        name: 'Free G3-N1CF Filter Coupon',
        description:
          'Applies to one-time purchases. Reward expires 1 month after being issued. Reward can only be used on CF Filter for Waterdrop G3P800 & G3P600 & G3 Reverse Osmosis System. Product must be added to cart before applying the code.',
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/3c31c10aca0c3c87a4e2f58e7d04ecc1953461adc51e9666b657bac90c17d77bcfb0b75b2b79d2a7.png'
      }
    },
    {
      id: 776387,
      exchange_type: 'fixed',
      exchange_description: '9000 Points',
      points_price: 9000,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2256427,
        name: 'Free G3-N3CB Filter Coupon',
        description:
          'Applies to one-time purchases. Reward expires 7 days after being issued. Reward can only be used on WD-G3-N3CB Filter for Waterdrop G3P800 & G3 Reverse Osmosis System. Product must be added to cart before applying the code.',
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/65f641ea10b182e880f7e5bca5b39ce99919fe08b8fe5ca2c80066f29e5f62d4ea6045bc9c44ace8.png'
      }
    },
    {
      id: 710299,
      exchange_type: 'fixed',
      exchange_description: '10000 Points',
      points_price: 10000,
      variable_points_step: null,
      variable_points_step_reward_value: null,
      variable_points_max: null,
      variable_points_min: null,
      reward: {
        id: 2042378,
        name: 'Free MNR35 Filter Coupon',
        description:
          'Applies to one-time purchases. Reward expires 7 days after being issued. Reward can only be used on Remineralization Filter for Waterdrop Undersink Reverse Osmosis Systems-Waterdrop MNR35. Product must be added to cart before applying the code.',
        image_url:
          'https://s3.amazonaws.com/sweettooth-api-uploads/reward/image/processed/eb88e3ba20ece8dd4baa677d2476fe175a39eecd35a3317cea00a77e36f0d097530e79c25dcf94e4.png'
      }
    }
  ],
  earning_rules: [
    {
      id: 1175644,
      name: 'Place an order - Bronze',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/5fda9eed3527c34b60d664a942bfb465aca1913df9c2e9643c1c1f8046da96c7cb19b13fe04d607a.png',
      reward_value: {
        type: 'variable',
        variable: {
          value: 10,
          per_amount: 1
        }
      }
    },
    {
      id: 1175309,
      name: 'Celebrate a birthday - Bronze',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/9bcb65289d71b9a9c37cdbb0f014aa17d1d1834fbec12d1e957c2f7ee8c2af3d5c55f29318d2dd62.png',
      reward_value: {
        type: 'fixed',
        fixed: {
          value: 500
        }
      }
    },
    {
      id: 1126952,
      name: 'Follow on TikTok',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/a3e3fb6e0c7992f7889addf0f24e8ded852782b8d2e173cd2fc7b64b2fa2e6a96ac16e3540015b10.png',
      reward_value: {
        type: 'fixed',
        fixed: {
          value: 150
        }
      }
    },
    {
      id: 963119,
      name: 'Share on Facebook',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/3071eda57c01d9490206cd6fa7789d81f0896f9996deb70a2c421b5d9b688a81caefb9e315a88336.png',
      reward_value: {
        type: 'fixed',
        fixed: {
          value: 200
        }
      }
    },
    {
      id: 870133,
      name: 'Subscribe to Newsletter',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/1f52615ad70275c56f62b133b208b2be74ad3023d7eb075ca107b2bf90a5e6f1b0eed14087a6ecf8.png',
      reward_value: {
        type: 'fixed',
        fixed: {
          value: 300
        }
      }
    },
    {
      id: 856110,
      name: 'Follow on Instagram',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/22f3fb46c00433602e221bbc7dce79bc254fc0e9a27a708e1c03881203d7f727b704b08a5b3784e9.png',
      reward_value: {
        type: 'fixed',
        fixed: {
          value: 150
        }
      }
    },
    {
      id: 854993,
      name: 'Place an order - Silver',
      image_url:
        'https://s3.amazonaws.com/sweettooth-api-uploads/activity_rule/image/processed/0aa8216fa3f926213ca8a94ab59f48624c66108ed3225373eeae5474673e097d71ba081893e2faf2.png',
      reward_value: {
        type: 'variable',
        variable: {
          value: 10,
          per_amount: 1
        }
      }
    }
  ],
  currencyCode: 'USD',
  storefrontUrl: 'https://dev-test-202051044.myshopify.com'
}

export const EDITOR_LOYALTY_TRANSACTIONS_DATA: LoyaltyTransactionsData = {
  points_transactions: [
    {
      id: 1,
      customer_id: 3235166587,
      points_change: 500,
      description: 'Signup',
      internal_note: null,
      created_at: '2026-06-17T01:30:00.000Z',
      updated_at: '2026-06-17T01:30:00.000Z'
    },
    {
      id: 2,
      customer_id: 3235166587,
      points_change: 700,
      description: 'Place an order',
      internal_note: null,
      created_at: '2026-06-17T01:40:00.000Z',
      updated_at: '2026-06-17T01:40:00.000Z'
    }
  ],
  next_cursor: null,
  previous_cursor: null
}
