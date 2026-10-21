import { describe, expect, it } from "vitest";
import { orderExtraWhere } from "../../src/modules/orders/order-filters";
import { OrderSearchQueryDto } from "../../src/modules/orders/orders.dto";

describe("orders page filters", () => {
  it("adds nothing when no filter is set", () => {
    expect(orderExtraWhere({})).toEqual({});
  });

  it("filters by payment method, coupon, staff, zone and total", () => {
    expect(
      orderExtraWhere({ paymentGateway: "bkash", hasCoupon: true, createdByAdminId: 3n, shippingZoneId: 7n, minTotal: 100, maxTotal: 500 }),
    ).toEqual({
      paymentGatewayCode: { equals: "bkash", mode: "insensitive" },
      couponUsed: { not: null },
      createdByAdminId: 3n,
      shippingZoneId: 7n,
      grandTotal: { gte: 100, lte: 500 },
    });
  });

  it("can pick orders without a coupon", () => {
    expect(orderExtraWhere({ hasCoupon: false })).toEqual({ couponUsed: null });
  });

  it("reads the filters from the query string", () => {
    const q = OrderSearchQueryDto.parse({ hasCoupon: "false", createdByAdminId: "4", shippingZoneId: "2", paymentGateway: "cod" });
    expect(q).toMatchObject({ hasCoupon: false, createdByAdminId: 4n, shippingZoneId: 2n, paymentGateway: "cod" });
  });
});
