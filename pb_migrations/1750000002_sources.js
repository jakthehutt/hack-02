/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "sources",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", presentable: true, max: 500 },
      { type: "text", name: "source_id", required: true, min: 1, max: 200 },
      { type: "number", name: "rank" },
      { type: "text", name: "rank_label", max: 500 },
      { type: "text", name: "rank_id", max: 200 },
      { type: "text", name: "control", max: 200 },
      { type: "text", name: "language", max: 32 },
      { type: "text", name: "operator", max: 1000 },
      { type: "text", name: "status", max: 2000 },
      { type: "json", name: "domains", maxSize: 2000000 },
      { type: "json", name: "channels", maxSize: 2000000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_sources_source_id ON sources (source_id)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("sources")
  app.delete(collection)
})
