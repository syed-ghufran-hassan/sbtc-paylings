import { Clarinet, Tx, Chain, Account, types } from "https://deno.land/x/clarinet@v1.5.0/index.ts";
import { assertEquals, assert } from "https://deno.land/std@0.203.0/testing/asserts.ts";

Clarinet.test({
  name: "sbtc-paylings: create, cancel, expire, and retrieve pay-tags",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const user1 = accounts.get("wallet_1")!;
    const user2 = accounts.get("wallet_2")!;

    // 1. Create a PayTag
    let block = chain.mineBlock([
      Tx.contractCall(
        "sbtc-paylings",
        "create-pay-tag",
        [types.uint(100), types.uint(10), types.none()],
        user1.address
      )
    ]);
    const createResult = block.receipts[0].result;
    assertEquals(createResult.expectOk().toString(), "1");

    // 2. Get the PayTag by ID
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "get-pay-tag", [types.uint(1)], user1.address)
    ]);
    const tag = block.receipts[0].result.expectOk();
    assertEquals(tag["amount"], 100);
    assertEquals(tag["state"], "pending");

    // 3. Cancel the PayTag
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "cancel-pay-tag", [types.uint(1)], user1.address)
    ]);
    const cancelResult = block.receipts[0].result;
    assertEquals(cancelResult.expectOk().toString(), "1");

    // 4. Verify PayTag state is now canceled
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "get-pay-tag", [types.uint(1)], user1.address)
    ]);
    const canceledTag = block.receipts[0].result.expectOk();
    assertEquals(canceledTag["state"], "canceled");

    // 5. Create another PayTag for expiration test
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "create-pay-tag", [types.uint(50), types.uint(1), types.none()], user2.address)
    ]);
    const newTagId = block.receipts[0].result.expectOk().toString();

    // Simulate blocks passing to expire the tag
    chain.mineEmptyBlock(2);

    // 6. Mark PayTag as expired
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "mark-expired", [types.uint(Number(newTagId))], user2.address)
    ]);
    const expireResult = block.receipts[0].result;
    assertEquals(expireResult.expectOk().toString(), newTagId);

    // 7. Verify state is now expired
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "get-pay-tag", [types.uint(Number(newTagId))], user2.address)
    ]);
    const expiredTag = block.receipts[0].result.expectOk();
    assertEquals(expiredTag["state"], "expired");

    // 8. Test batch retrieval
    block = chain.mineBlock([
      Tx.contractCall("sbtc-paylings", "get-multiple-tags", [types.list([types.uint(1), types.uint(Number(newTagId))])], user1.address)
    ]);
    const batchResult = block.receipts[0].result.expectOk();
    assert(batchResult.length === 2);
  },
});
