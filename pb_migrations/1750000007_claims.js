/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "claims",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "quote", presentable: true, max: 2000 },
      { type: "text", name: "claim_key", required: true, min: 1, max: 500 },
      { type: "text", name: "status", max: 32 },
      { type: "text", name: "frame_id", max: 200 },
      { type: "text", name: "kind", max: 32 },
      { type: "text", name: "label", max: 500 },
      { type: "text", name: "target", max: 200 },
      { type: "text", name: "article_id", max: 128 },
      { type: "text", name: "source_id", max: 200 },
      { type: "number", name: "rank" },
      { type: "text", name: "week", max: 16 },
      { type: "text", name: "copy_cluster_id", max: 200 },
      { type: "text", name: "corpus", max: 64 },
      { type: "text", name: "codebook_version", max: 64 },
      { type: "text", name: "url", max: 2000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_claims_claim_key ON claims (claim_key)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("claims")
  app.delete(collection)
})
