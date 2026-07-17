# Cart line item subscription note拓展说明

此 Customer Account UI 扩展运行在 `customer-account.order-status.cart-line-item.render-after`。

它通过 Order Status Cart Lines API 读取当前购物车行项目，并且只会为带有 `__per_delivery` 自定义属性、且行项目总金额为零的订阅折扣行渲染。
`__per_delivery`：是整机订购省的独有属性，用于判断当前行是否是整机订购省
`价格 === 0`：判断是否是第一次订单
