import { describe, it, expect } from "vitest"
import {
  categoryLookup,
  money,
  parseCsv,
  planImport,
  toRows,
  whole,
  type Lookups,
} from "../../src/modules/catalog/import/import.rules"

describe("reading a product sheet", () => {
  it("parses quoted cells, doubled quotes, line breaks and the separator Excel used", () => {
    expect(parseCsv('﻿a,b,c\r\n1,"x, y","say ""hi"""\n\n2,"two\nlines",\n')).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'say "hi"'],
      ["2", "two\nlines", ""],
    ])
    expect(parseCsv("sku;name;price\nA1;Kurta;1,250")).toEqual([
      ["sku", "name", "price"],
      ["A1", "Kurta", "1,250"],
    ])
    expect(parseCsv("sku\tname\nA1\tKurta")[1]).toEqual(["A1", "Kurta"])
  })

  it("knows columns by other names and lists the ones it ignores", () => {
    const { rows, unknownColumns, missingColumns } = toRows([
      ["SKU", "Product Name", "Regular Price", "Qty", "Colour code"],
      ["A1", "Kurta", "1250", "5", "#f00"],
    ])
    expect(rows).toEqual([{ _row: 2, product_sku: "A1", name: "Kurta", price: "1250", stock: "5" }])
    expect(unknownColumns).toEqual(["Colour code"])
    expect(missingColumns).toEqual([])
    expect(toRows([["name"], ["x"]]).missingColumns).toEqual(["product_sku"])
  })

  it("reads prices and stock written the local way", () => {
    expect(money("৳1,250.50")).toBe(1250.5)
    expect(money("১২৫০")).toBe(1250)
    expect(money(" 990 Tk")).toBe(990)
    expect(money("")).toBeUndefined()
    expect(money("about 500")).toBeNaN()
    expect(whole("১০")).toBe(10)
    expect(whole("2.5")).toBeNaN()
  })
})

describe("planning an import", () => {
  const categories = categoryLookup([
    { id: 1n, name: "Men", parentId: null },
    { id: 2n, name: "Shirts", parentId: 1n },
    { id: 3n, name: "Women", parentId: null },
    { id: 4n, name: "Shirts", parentId: 3n },
    { id: 5n, name: "Panjabi", parentId: 1n },
  ])
  const lk: Lookups = {
    categories,
    brands: new Map([["aarong", 9n]]),
    products: new Map([["old-1", { id: 50n, name: "Old kurta", variantSkus: ["old-1-m"] }]]),
    variantSkus: new Map([["old-1-m", "old-1"]]),
  }
  const plan = (text: string) => planImport(toRows(parseCsv(text)).rows, lk)

  it("finds categories by path, or by name when there's only one", () => {
    expect(categories.get("men > shirts")).toBe(2n)
    expect(categories.get("panjabi")).toBe(5n)
    expect(categories.get("shirts")).toBeNull()
    expect(categories.get("men")).toBe(1n)
  })

  it("makes a new simple product and updates an existing one, leaving blanks alone", () => {
    const p = plan(
      'product_sku,name,status,category,brand,price,sale_price,stock,tags\nNEW-1,Cotton Panjabi,Published,Men > Panjabi,Aarong,"৳2,500",2200,7,eid; cotton\nold-1,,,,,,1100,,',
    )
    expect(p.fileErrors).toEqual([])
    expect(p.summary).toMatchObject({ rows: 2, create: 1, update: 1, withErrors: 0 })
    expect(p.products[0]).toMatchObject({
      sku: "NEW-1",
      action: "create",
      name: "Cotton Panjabi",
      status: "published",
      categoryId: 5n,
      brandId: 9n,
      price: 2500,
      salePrice: 2200,
      stock: 7,
      tags: ["eid", "cotton"],
    })
    expect(p.products[1]).toMatchObject({
      sku: "old-1",
      action: "update",
      productId: 50n,
      salePrice: 1100,
      errors: [],
    })
    expect(p.products[1]!.name).toBeUndefined()
    expect(p.products[1]!.price).toBeUndefined()
  })

  it("groups variant rows under their product", () => {
    const p = plan(
      "product_sku,name,price,variant_sku,option1_name,option1_value,option2_name,option2_value,stock\n" +
        "TEE,Basic tee,500,,,,,,\nTEE,,,TEE-S-RED,Size,S,Colour,Red,4\nTEE,,550,TEE-M-RED,Size,M,Colour,Red,2",
    )
    expect(p.products).toHaveLength(1)
    const tee = p.products[0]!
    expect(tee.errors).toEqual([])
    expect(tee.variants.map((v) => [v.sku, v.options, v.price, v.stock])).toEqual([
      ["TEE-S-RED", { size: "S", colour: "Red" }, undefined, 4],
      ["TEE-M-RED", { size: "M", colour: "Red" }, 550, 2],
    ])
    expect(p.summary.variants).toBe(2)
  })

  it("explains every problem with its row", () => {
    const p = plan(
      "product_sku,name,status,category,brand,price,sale_price,image_urls,variant_sku,option1_name,option1_value\n" +
        ",Nameless,,,,100,,,,,\n" +
        "A,,,,,100,,,,,\n" +
        "B,Bee,sold,Shirts,Unknown,abc,,ftp://x,,,\n" +
        "C,Cee,,,,100,150,,,,\n" +
        "D,Dee,,,,,,,,,\n" +
        "E,Eee,,,,100,,,E-1,Size,S\nE,,,,,,,,E-2,Size,S\nE,,,,,,,,OLD-1-M,Size,M\nE,,,,,,,,,,L",
    )
    const errors = Object.fromEntries(
      p.products.map((x) => [x.sku, x.errors.map((e) => `${e.row}: ${e.message}`)]),
    )
    expect(p.fileErrors).toEqual(["Row 2: No product_sku: every row needs the product's SKU"])
    expect(errors.A).toEqual(["3: A new product needs a name"])
    expect(errors.B).toEqual([
      '4: Status "sold" isn\'t one of published, draft or archived',
      '4: More than one category is called "Shirts"; use its path like "Men > Shirts"',
      '4: Brand "Unknown" wasn\'t found; add it first',
      '4: Picture "ftp://x" isn\'t a web address (http… or https…)',
      '4: Price "abc" isn\'t a number',
      "4: A new product needs a price",
    ])
    expect(errors.C).toEqual(["5: The sale price is higher than the price"])
    expect(errors.D).toEqual(["6: A new product needs a price"])
    expect(errors.E).toEqual([
      "8: The same options (S) are listed twice",
      '9: Variant SKU "OLD-1-M" already belongs to product "OLD-1"',
    ])
    expect(p.summary).toMatchObject({ create: 0, withErrors: 5 })
  })

  it("refuses a file with too many rows", () => {
    const body = Array.from({ length: 2001 }, (_, i) => `S${i},Item ${i},100`).join("\n")
    expect(plan(`product_sku,name,price\n${body}`).fileErrors[0]).toMatch(
      /2001 rows; import at most 2000/,
    )
  })
})
