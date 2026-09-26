/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "edges",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "example_overlap", presentable: true, max: 2000 },
      { type: "text", name: "edge_key", required: true, min: 1, max: 600 },
      { type: "text", name: "from_article_id", max: 128 },
      { type: "text", name: "to_article_id", max: 128 },
      { type: "text", name: "from_source_id", max: 200 },
      { type: "text", name: "to_source_id", max: 200 },
      { type: "text", name: "relation", max: 64 },
      { type: "text", name: "rule", max: 200 },
      { type: "number", name: "lag_hours" },
      { type: "number", name: "similarity" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_edges_edge_key ON edges (edge_key)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("edges")
  app.delete(collection)
})
